package auth

import (
	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	var user database.User
	if err := database.DB.Preload("Role").Where("email = ? AND is_active = true", req.Email).First(&user).Error; err != nil {
		response.Unauthorized(c, "Invalid email or password")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		response.Unauthorized(c, "Invalid email or password")
		return
	}

	accessToken, err := GenerateAccessToken(user.ID, user.Email, user.Role.Name)
	if err != nil {
		response.InternalError(c, "Failed to generate token")
		return
	}

	refreshToken, err := GenerateRefreshToken(user.ID, user.Email, user.Role.Name)
	if err != nil {
		response.InternalError(c, "Failed to generate refresh token")
		return
	}

	response.OK(c, "Login successful", gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"user": gin.H{
			"id":       user.ID,
			"name":     user.Name,
			"email":    user.Email,
			"role":     user.Role.Name,
			"position": user.Position,
		},
	})
}

func Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	claims, err := ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		response.Unauthorized(c, "Invalid or expired refresh token")
		return
	}

	var user database.User
	if err := database.DB.Preload("Role").Where("id = ? AND is_active = true", claims.UserID).First(&user).Error; err != nil {
		response.Unauthorized(c, "User not found or inactive")
		return
	}

	accessToken, err := GenerateAccessToken(user.ID, user.Email, user.Role.Name)
	if err != nil {
		response.InternalError(c, "Failed to generate token")
		return
	}

	newRefreshToken, err := GenerateRefreshToken(user.ID, user.Email, user.Role.Name)
	if err != nil {
		response.InternalError(c, "Failed to generate refresh token")
		return
	}

	response.OK(c, "Token refreshed", gin.H{
		"access_token":  accessToken,
		"refresh_token": newRefreshToken,
	})
}

func Logout(c *gin.Context) {
	response.OK(c, "Logged out successfully", nil)
}

func Me(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		response.Unauthorized(c, "Invalid user")
		return
	}

	var user database.User
	if err := database.DB.Preload("Role").Preload("Department").Where("id = ?", userID).First(&user).Error; err != nil {
		response.NotFound(c, "User not found")
		return
	}

	response.OK(c, "User retrieved", user)
}
