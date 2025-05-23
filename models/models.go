package models

import (
	"time" //

	"gorm.io/gorm" //
)

// Role representa los roles del sistema
type Role struct { //
	RoleID   uint   `gorm:"primaryKey;autoIncrement" json:"role_id"` //
	RoleName string `gorm:"not null;unique" json:"role_name"`        //
}

// User representa los usuarios del sistema
type User struct { //
	UserID       uint      `gorm:"primaryKey;autoIncrement" json:"user_id"` //
	Email        string    `gorm:"not null;unique" json:"email"`            //
	PasswordHash string    `gorm:"not null" json:"-"`                       //
	FullName     string    `json:"full_name"`                               //
	RoleID       uint      `gorm:"not null" json:"role_id"`                 //
	IsActive     bool      `gorm:"default:true" json:"is_active"`           //
	CreatedAt    time.Time `json:"created_at"`                              //

	// Relaciones
	Role Role `gorm:"foreignKey:RoleID" json:"role,omitempty"` //
}

// ConceptType representa los tipos de conceptos
type ConceptType struct { //
	ConceptID               uint      `gorm:"primaryKey;autoIncrement" json:"concept_id"`                                      //
	ConceptName             string    `gorm:"not null;unique" json:"concept_name"`                                             //
	MovementTypeAssociation string    `gorm:"type:enum('Ingreso','Egreso','Ambos');not null" json:"movement_type_association"` //
	IsActive                bool      `gorm:"default:true" json:"is_active"`                                                   //
	CreatedBy               *uint     `json:"created_by"`                                                                      //
	CreatedAt               time.Time `json:"created_at"`                                                                      //

	// Relación
	Creator *User `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"` //
}

// Movement representa los movimientos base
type Movement struct { //
	MovementID   uint           `gorm:"primaryKey;autoIncrement" json:"movement_id"`                 //
	ReferenceID  string         `gorm:"not null;unique" json:"reference_id"`                         //
	MovementType string         `gorm:"type:enum('Ingreso','Egreso');not null" json:"movement_type"` //
	MovementDate time.Time      `gorm:"not null" json:"movement_date"`                               //
	Amount       float64        `gorm:"type:decimal(15,2);not null" json:"amount"`                   //
	Shift        string         `gorm:"type:enum('M','T');not null" json:"shift"`                    //
	ConceptID    uint           `gorm:"not null" json:"concept_id"`                                  //
	Details      string         `json:"details"`                                                     //
	CreatedBy    uint           `gorm:"not null" json:"created_by"`                                  //
	CreatedAt    time.Time      `json:"created_at"`                                                  //
	UpdatedBy    *uint          `json:"updated_by"`                                                  //
	UpdatedAt    *time.Time     `json:"updated_at"`                                                  //
	DeletedBy    *uint          `json:"deleted_by"`                                                  //
	DeletedAt    gorm.DeletedAt `json:"deleted_at"`                                                  //

	// Relaciones
	Concept ConceptType `gorm:"foreignKey:ConceptID" json:"concept,omitempty"` //
	Creator User        `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"` //
	Updater *User       `gorm:"foreignKey:UpdatedBy" json:"updater,omitempty"` //
	Deleter *User       `gorm:"foreignKey:DeletedBy" json:"deleter,omitempty"` //
}

// SpecificIncome para datos específicos de ingresos
type SpecificIncome struct { //
	SpecificIncomeID uint `gorm:"primaryKey;autoIncrement" json:"specific_income_id"` //
	MovementID       uint `gorm:"not null;unique" json:"movement_id"`                 //

	// Relación
	Movement Movement `gorm:"foreignKey:MovementID" json:"movement,omitempty"` //
}

// SpecificExpense para datos específicos de egresos
type SpecificExpense struct { //
	SpecificExpenseID uint `gorm:"primaryKey;autoIncrement" json:"specific_expense_id"` //
	MovementID        uint `gorm:"not null;unique" json:"movement_id"`                  //

	// Relación
	Movement Movement `gorm:"foreignKey:MovementID" json:"movement,omitempty"` //
}

// DTOs para requests
type LoginRequest struct { //
	Email    string `json:"email" binding:"required,email"` //
	Password string `json:"password" binding:"required"`    //
}

type MovementRequest struct { //
	MovementType string  `json:"movement_type" binding:"required,oneof=Ingreso Egreso"` //
	Amount       float64 `json:"amount" binding:"required,gt=0"`                        //
	Shift        string  `json:"shift" binding:"required,oneof=M T"`                    //
	ConceptID    uint    `json:"concept_id" binding:"required"`                         //
	Details      string  `json:"details"`                                               //
	CreatedBy    uint    `json:"created_by" binding:"required"`                         //
}

type BatchMovementRequest struct { //
	Movements []MovementRequest `json:"movements" binding:"required,dive"` //
}
