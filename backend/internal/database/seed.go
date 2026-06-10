package database

import (
	"log"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func Seed() {
	seedRoles()
	seedDepartments()
	seedUsers()
	seedAuditees()
	log.Println("Database seeded successfully")
}

func seedRoles() {
	roles := []Role{
		{Base: Base{ID: uuid.MustParse("00000000-0000-0000-0000-000000000001")}, Name: "admin", Description: "System Administrator"},
		{Base: Base{ID: uuid.MustParse("00000000-0000-0000-0000-000000000002")}, Name: "auditor", Description: "Internal Auditor"},
		{Base: Base{ID: uuid.MustParse("00000000-0000-0000-0000-000000000003")}, Name: "spv", Description: "Supervisor / Section Head"},
		{Base: Base{ID: uuid.MustParse("00000000-0000-0000-0000-000000000004")}, Name: "dept_head", Description: "Kepala Bagian / Department Head"},
		{Base: Base{ID: uuid.MustParse("00000000-0000-0000-0000-000000000005")}, Name: "div_head", Description: "Kepala Divisi / Division Head"},
	}

	for _, r := range roles {
		r.CreatedAt = time.Now()
		r.UpdatedAt = time.Now()
		DB.FirstOrCreate(&r, Role{Name: r.Name})
	}
}

func seedDepartments() {
	dept := Department{
		Base: Base{ID: uuid.MustParse("10000000-0000-0000-0000-000000000001")},
		Name: "Internal Audit",
	}
	dept.CreatedAt = time.Now()
	dept.UpdatedAt = time.Now()
	DB.FirstOrCreate(&dept, Department{Name: dept.Name})
}

func seedUsers() {
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	deptID := uuid.MustParse("10000000-0000-0000-0000-000000000001")

	users := []User{
		{
			Base:         Base{ID: uuid.MustParse("20000000-0000-0000-0000-000000000001")},
			Name:         "Admin Sistem",
			Email:        "admin@audit.local",
			PasswordHash: string(hash),
			RoleID:       uuid.MustParse("00000000-0000-0000-0000-000000000001"),
			DepartmentID: &deptID,
			Position:     "System Administrator",
			IsActive:     true,
		},
		{
			Base:         Base{ID: uuid.MustParse("20000000-0000-0000-0000-000000000002")},
			Name:         "Budi Auditor",
			Email:        "auditor@audit.local",
			PasswordHash: string(hash),
			RoleID:       uuid.MustParse("00000000-0000-0000-0000-000000000002"),
			DepartmentID: &deptID,
			Position:     "Staff Auditor",
			IsActive:     true,
		},
		{
			Base:         Base{ID: uuid.MustParse("20000000-0000-0000-0000-000000000003")},
			Name:         "Sari Supervisor",
			Email:        "spv@audit.local",
			PasswordHash: string(hash),
			RoleID:       uuid.MustParse("00000000-0000-0000-0000-000000000003"),
			DepartmentID: &deptID,
			Position:     "Supervisor",
			IsActive:     true,
		},
		{
			Base:         Base{ID: uuid.MustParse("20000000-0000-0000-0000-000000000004")},
			Name:         "Dewi Kepala Bagian",
			Email:        "depthead@audit.local",
			PasswordHash: string(hash),
			RoleID:       uuid.MustParse("00000000-0000-0000-0000-000000000004"),
			DepartmentID: &deptID,
			Position:     "Kepala Bagian Audit",
			IsActive:     true,
		},
		{
			Base:         Base{ID: uuid.MustParse("20000000-0000-0000-0000-000000000005")},
			Name:         "Hendro Kepala Divisi",
			Email:        "divhead@audit.local",
			PasswordHash: string(hash),
			RoleID:       uuid.MustParse("00000000-0000-0000-0000-000000000005"),
			DepartmentID: &deptID,
			Position:     "Kepala Divisi Internal Audit",
			IsActive:     true,
		},
	}

	for _, u := range users {
		u.CreatedAt = time.Now()
		u.UpdatedAt = time.Now()
		DB.FirstOrCreate(&u, User{Email: u.Email})
	}
}

func seedAuditees() {
	deptID := uuid.MustParse("10000000-0000-0000-0000-000000000001")
	auditees := []Auditee{
		{
			Base:          Base{ID: uuid.MustParse("30000000-0000-0000-0000-000000000001")},
			Name:          "Divisi Klaim",
			Type:          "division",
			DepartmentID:  &deptID,
			ContactPerson: "Ahmad Klaim",
			Email:         "klaim@perusahaan.local",
			IsActive:      true,
		},
		{
			Base:          Base{ID: uuid.MustParse("30000000-0000-0000-0000-000000000002")},
			Name:          "Divisi Underwriting",
			Type:          "division",
			DepartmentID:  &deptID,
			ContactPerson: "Bina Underwriting",
			Email:         "uw@perusahaan.local",
			IsActive:      true,
		},
		{
			Base:          Base{ID: uuid.MustParse("30000000-0000-0000-0000-000000000003")},
			Name:          "Cabang Jakarta Selatan",
			Type:          "branch",
			ContactPerson: "Citra Cabang",
			Email:         "jaksel@perusahaan.local",
			IsActive:      true,
		},
	}

	for _, a := range auditees {
		a.CreatedAt = time.Now()
		a.UpdatedAt = time.Now()
		DB.FirstOrCreate(&a, Auditee{Name: a.Name})
	}
}
