from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "analyst"  # admin, analyst, viewer
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

# --- Cleaning Options ---
class CleaningOptions(BaseModel):
    drop_duplicates: bool = True
    fill_nulls: bool = True
    numeric_strategy: str = "median"  # median, mean, zero
    categorical_strategy: str = "mode"  # mode, unknown
    standardize_columns: bool = True
    standardize_dates: bool = True

# --- Table / Dataset Schemas ---
class ColumnInfo(BaseModel):
    name: str
    original_name: str
    data_type: str
    null_count: int
    unique_count: int

class CleaningSummary(BaseModel):
    initial_rows: int
    final_rows: int
    duplicates_removed: int
    null_values_filled: int
    nulls_per_column: Dict[str, int]
    column_transformations: List[str]
    processing_time_ms: float

class DatasetResponse(BaseModel):
    id: int
    table_name: str
    original_filename: str
    row_count: int
    column_count: int
    table_type: str
    schema_info: List[Dict[str, Any]]
    cleaning_summary: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True

class TableDataPreview(BaseModel):
    table_name: str
    total_rows: int
    columns: List[str]
    rows: List[Dict[str, Any]]

class SchemaRelationship(BaseModel):
    source_table: str
    source_column: str
    target_table: str
    target_column: str
    relationship_type: str  # "many-to-one", "one-to-one"

class SQLQueryRequest(BaseModel):
    query: str

class SQLQueryResponse(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    row_count: int
    execution_time_ms: float
