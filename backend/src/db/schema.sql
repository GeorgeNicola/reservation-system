-- =============================================================
-- Reservation System - Database Schema
-- PostgreSQL 16
-- =============================================================

-- Users table (patients and doctors)
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    role            VARCHAR(20) NOT NULL DEFAULT 'patient'
                    CHECK (role IN ('patient', 'doctor')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clinics table (each clinic belongs to one doctor)
CREATE TABLE clinics (
    id              SERIAL PRIMARY KEY,
    doctor_id       INTEGER NOT NULL UNIQUE
                    REFERENCES users(id) ON DELETE RESTRICT,
    name            VARCHAR(255) NOT NULL,
    specialty       VARCHAR(100) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Services table (each service belongs to one clinic, has a duration)
CREATE TABLE services (
    id                  SERIAL PRIMARY KEY,
    clinic_id           INTEGER NOT NULL
                        REFERENCES clinics(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    duration_minutes    INTEGER NOT NULL CHECK (duration_minutes > 0),
    price               DECIMAL(10, 2),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reservations table (central table)
CREATE TABLE reservations (
    id                      SERIAL PRIMARY KEY,
    clinic_id               INTEGER NOT NULL
                            REFERENCES clinics(id) ON DELETE RESTRICT,
    patient_id              INTEGER NOT NULL
                            REFERENCES users(id) ON DELETE RESTRICT,
    service_id              INTEGER NOT NULL
                            REFERENCES services(id) ON DELETE RESTRICT,
    start_time              TIMESTAMPTZ NOT NULL,
    end_time                TIMESTAMPTZ NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                            CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    processed_by_instance   VARCHAR(50),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_interval CHECK (end_time > start_time)
);

-- Reservation jobs table (outbox pattern for queue strategy)
CREATE TABLE reservation_jobs (
    id                      SERIAL PRIMARY KEY,
    clinic_id               INTEGER NOT NULL
                            REFERENCES clinics(id) ON DELETE RESTRICT,
    patient_id              INTEGER NOT NULL
                            REFERENCES users(id) ON DELETE RESTRICT,
    service_id              INTEGER NOT NULL
                            REFERENCES services(id) ON DELETE RESTRICT,
    start_time              TIMESTAMPTZ NOT NULL,
    end_time                TIMESTAMPTZ NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result_reservation_id   INTEGER REFERENCES reservations(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at            TIMESTAMPTZ,
    CONSTRAINT valid_job_interval CHECK (end_time > start_time)
);

-- Critical index for overlap checking performance
CREATE INDEX idx_reservations_clinic_time
    ON reservations(clinic_id, start_time, end_time);

CREATE INDEX idx_services_clinic ON services(clinic_id);

CREATE INDEX idx_jobs_status ON reservation_jobs(status)
    WHERE status IN ('pending', 'processing');

-- Fencing token sequence (for distributed locking strategy)
CREATE SEQUENCE lock_fence_seq START 1 INCREMENT 1;

-- =============================================================
-- Seed Data
-- =============================================================

-- 5 doctors
INSERT INTO users (email, password_hash, full_name, role) VALUES
    ('doctor1@demo.com', '$2b$10$placeholder', 'Dr. Popescu Ion',        'doctor'),
    ('doctor2@demo.com', '$2b$10$placeholder', 'Dr. Ionescu Maria',      'doctor'),
    ('doctor3@demo.com', '$2b$10$placeholder', 'Dr. Georgescu Andrei',   'doctor'),
    ('doctor4@demo.com', '$2b$10$placeholder', 'Dr. Stanescu Elena',     'doctor'),
    ('doctor5@demo.com', '$2b$10$placeholder', 'Dr. Mihai Cristian',     'doctor');

-- 100 patients (patient_id 6-105) for k6 random selection
INSERT INTO users (email, password_hash, full_name, role)
SELECT
    'patient' || g || '@demo.com',
    '$2b$10$placeholder',
    'Pacient ' || g,
    'patient'
FROM generate_series(1, 100) AS g;

-- 5 clinics
INSERT INTO clinics (doctor_id, name, specialty) VALUES
    (1, 'Cabinet Cardiologie Popescu',     'Cardiologie'),
    (2, 'Cabinet Stomatologie Ionescu',    'Stomatologie'),
    (3, 'Cabinet Dermatologie Georgescu',  'Dermatologie'),
    (4, 'Cabinet Pediatrie Stanescu',      'Pediatrie'),
    (5, 'Cabinet Neurologie Mihai',        'Neurologie');

-- Services per clinic
INSERT INTO services (clinic_id, name, duration_minutes, price) VALUES
    (1, 'Consultatie cardiologica',  30, 150.00),
    (1, 'EKG',                       20,  80.00),
    (2, 'Consultatie stomatologica', 30, 100.00),
    (2, 'Detartraj',                 45, 200.00),
    (2, 'Plomba',                    60, 250.00),
    (3, 'Consultatie dermatologica', 30, 120.00),
    (4, 'Consultatie pediatrica',    30,  90.00),
    (5, 'Consultatie neurologica',   45, 180.00);
