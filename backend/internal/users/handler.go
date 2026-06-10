package users

import (
	"strconv"

	"github.com/clairencelie/audit-dashboard/backend/internal/database"
	"github.com/clairencelie/audit-dashboard/backend/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type createUserRequest struct {
	Name         string `json:"name" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=8"`
	RoleID       string `json:"role_id" binding:"required"`
	DepartmentID string `json:"department_id"`
	Position     string `json:"position"`
}

type updateUserRequest struct {
	Name         string `json:"name"`
	RoleID       string `json:"role_id"`
	DepartmentID string `json:"department_id"`
	Position     string `json:"position"`
	IsActive     *bool  `json:"is_active"`
}

func ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")
	roleFilter := c.Query("role")

	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	query := database.DB.Model(&database.User{}).Preload("Role").Preload("Department")

	if search != "" {
		query = query.Where("name ILIKE ? OR email ILIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if roleFilter != "" {
		query = query.Joins("JOIN roles ON roles.id = users.role_id").Where("roles.name = ?", roleFilter)
	}

	var total int64
	query.Count(&total)

	var users []database.User
	query.Offset(offset).Limit(limit).Order("name ASC").Find(&users)

	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	response.Paginated(c, "Users retrieved", users, response.PaginateMeta{
		Page: page, Limit: limit, Total: total, TotalPages: totalPages,
	})
}

func GetUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid user ID")
		return
	}

	var user database.User
	if err := database.DB.Preload("Role").Preload("Department").First(&user, "id = ?", id).Error; err != nil {
		response.NotFound(c, "User not found")
		return
	}

	response.OK(c, "User retrieved", user)
}

func CreateUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	roleID, err := uuid.Parse(req.RoleID)
	if err != nil {
		response.BadRequest(c, "Invalid role ID")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		response.InternalError(c, "Failed to hash password")
		return
	}

	user := database.User{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hash),
		RoleID:       roleID,
		Position:     req.Position,
		IsActive:     true,
	}

	if req.DepartmentID != "" {
		deptID, _ := uuid.Parse(req.DepartmentID)
		user.DepartmentID = &deptID
	}

	if err := database.DB.Create(&user).Error; err != nil {
		response.InternalError(c, "Failed to create user")
		return
	}

	database.DB.Preload("Role").Preload("Department").First(&user, "id = ?", user.ID)
	response.Created(c, "User created", user)
}

func UpdateUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid user ID")
		return
	}

	var user database.User
	if err := database.DB.First(&user, "id = ?", id).Error; err != nil {
		response.NotFound(c, "User not found")
		return
	}

	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.RoleID != "" {
		roleID, _ := uuid.Parse(req.RoleID)
		updates["role_id"] = roleID
	}
	if req.Position != "" {
		updates["position"] = req.Position
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.DepartmentID != "" {
		deptID, _ := uuid.Parse(req.DepartmentID)
		updates["department_id"] = deptID
	}

	database.DB.Model(&user).Updates(updates)
	database.DB.Preload("Role").Preload("Department").First(&user, "id = ?", id)
	response.OK(c, "User updated", user)
}

func ListRoles(c *gin.Context) {
	var roles []database.Role
	database.DB.Find(&roles)
	response.OK(c, "Roles retrieved", roles)
}

func ListDepartments(c *gin.Context) {
	var depts []database.Department
	database.DB.Find(&depts)
	response.OK(c, "Departments retrieved", depts)
}

func CreateDepartment(c *gin.Context) {
	var req struct {
		Name     string `json:"name" binding:"required"`
		ParentID string `json:"parent_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	dept := database.Department{Name: req.Name}
	if req.ParentID != "" {
		pid, _ := uuid.Parse(req.ParentID)
		dept.ParentID = &pid
	}

	if err := database.DB.Create(&dept).Error; err != nil {
		response.InternalError(c, "Failed to create department")
		return
	}
	response.Created(c, "Department created", dept)
}

func ListAuditees(c *gin.Context) {
	var auditees []database.Auditee
	database.DB.Preload("Department").Where("is_active = true").Find(&auditees)
	response.OK(c, "Auditees retrieved", auditees)
}

func CreateAuditee(c *gin.Context) {
	var req struct {
		Name          string `json:"name" binding:"required"`
		Type          string `json:"type"`
		DepartmentID  string `json:"department_id"`
		ContactPerson string `json:"contact_person"`
		Email         string `json:"email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	auditee := database.Auditee{
		Name:          req.Name,
		Type:          req.Type,
		ContactPerson: req.ContactPerson,
		Email:         req.Email,
		IsActive:      true,
	}
	if req.DepartmentID != "" {
		did, _ := uuid.Parse(req.DepartmentID)
		auditee.DepartmentID = &did
	}

	if err := database.DB.Create(&auditee).Error; err != nil {
		response.InternalError(c, "Failed to create auditee")
		return
	}
	response.Created(c, "Auditee created", auditee)
}

func UpdateAuditee(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid auditee ID")
		return
	}

	var auditee database.Auditee
	if err := database.DB.First(&auditee, "id = ?", id).Error; err != nil {
		response.NotFound(c, "Auditee not found")
		return
	}

	var req struct {
		Name          string `json:"name"`
		Type          string `json:"type"`
		ContactPerson string `json:"contact_person"`
		Email         string `json:"email"`
		IsActive      *bool  `json:"is_active"`
	}
	c.ShouldBindJSON(&req)

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Type != "" {
		updates["type"] = req.Type
	}
	if req.ContactPerson != "" {
		updates["contact_person"] = req.ContactPerson
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	database.DB.Model(&auditee).Updates(updates)
	response.OK(c, "Auditee updated", auditee)
}
