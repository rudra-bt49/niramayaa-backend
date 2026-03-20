-- CreateEnum
CREATE TYPE "Specialty" AS ENUM ('GENERAL_PRACTICE', 'INTERNAL_MEDICINE', 'CARDIOLOGY', 'DERMATOLOGY', 'ENDOCRINOLOGY', 'GASTROENTEROLOGY', 'NEUROLOGY', 'NEPHROLOGY', 'ONCOLOGY', 'OPHTHALMOLOGY', 'ORTHOPEDICS', 'OTOLARYNGOLOGY', 'PEDIATRICS', 'PSYCHIATRY', 'PULMONOLOGY', 'RADIOLOGY', 'RHEUMATOLOGY', 'UROLOGY', 'OBSTETRICS_AND_GYNECOLOGY', 'ANESTHESIOLOGY', 'EMERGENCY_MEDICINE', 'PATHOLOGY', 'PLASTIC_SURGERY', 'GENERAL_SURGERY', 'VASCULAR_SURGERY', 'INFECTIOUS_DISEASE', 'HEMATOLOGY', 'GERIATRICS', 'SPORTS_MEDICINE', 'PALLIATIVE_CARE', 'DENTISTRY', 'PHYSIOTHERAPY', 'NUTRITION_AND_DIETETICS', 'AUDIOLOGY');

-- CreateEnum
CREATE TYPE "Qualification" AS ENUM ('MBBS', 'MD', 'MS', 'DO', 'BDS', 'MDS', 'BAMS', 'BHMS', 'BUMS', 'BNYS', 'DM', 'MCH', 'DNB', 'FCPS', 'MRCP', 'MRCS', 'FRCS', 'FRCP', 'PHD', 'MPH', 'BSC_NURSING', 'MSC_NURSING', 'BPT', 'MPT', 'BSC_ALLIED_HEALTH');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PAYMENT_PENDING', 'SCHEDULED', 'PAYMENT_FAILED', 'COMPLETED', 'REFUND_REQUESTED');

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "phone_number" TEXT,
    "city" TEXT,
    "profile_image" TEXT,
    "profile_image_public_id" TEXT,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_id" TEXT,
    "device_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_token" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_plan" (
    "id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_profile" (
    "user_id" TEXT NOT NULL,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "blood_group" "BloodType",
    "allergies" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_profile_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "doctor_profile" (
    "user_id" TEXT NOT NULL,
    "bio" TEXT,
    "specialties" "Specialty"[],
    "experience" INTEGER,
    "qualifications" "Qualification"[],
    "consultation_fee" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "plan_id" TEXT,
    "plan_expires_at" TIMESTAMP(3),
    "qrcode_token" TEXT,
    "qrcode_image_url" TEXT,
    "qrcode_public_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_profile_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "break_start" TIMESTAMP(3),
    "break_end" TIMESTAMP(3),
    "slot_duration" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "queue_capacity" INTEGER NOT NULL DEFAULT 0,
    "current_queue_token" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "availability_id" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "queue_token" INTEGER,
    "status" "AppointmentStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "blood_group" "BloodType" NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_report" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "report_url" TEXT,
    "report_public_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_payment" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "receipt_url" TEXT,
    "stripe_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payment" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "receipt_url" TEXT,
    "stripe_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_session_refresh_token_hash_key" ON "user_session"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_session_user_id_idx" ON "user_session"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_token_token_hash_key" ON "password_reset_token"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_token_user_id_idx" ON "password_reset_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_plan_plan_name_key" ON "doctor_plan"("plan_name");

-- CreateIndex
CREATE INDEX "availability_doctor_id_idx" ON "availability"("doctor_id");

-- CreateIndex
CREATE INDEX "availability_start_at_idx" ON "availability"("start_at");

-- CreateIndex
CREATE UNIQUE INDEX "availability_doctor_id_start_at_key" ON "availability"("doctor_id", "start_at");

-- CreateIndex
CREATE INDEX "appointment_patient_id_idx" ON "appointment"("patient_id");

-- CreateIndex
CREATE INDEX "appointment_doctor_id_idx" ON "appointment"("doctor_id");

-- CreateIndex
CREATE INDEX "appointment_status_idx" ON "appointment"("status");

-- CreateIndex
CREATE INDEX "appointment_start_at_idx" ON "appointment"("start_at");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_doctor_id_start_at_key" ON "appointment"("doctor_id", "start_at");

-- CreateIndex
CREATE INDEX "medical_report_appointment_id_idx" ON "medical_report"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_payment_appointment_id_key" ON "appointment_payment"("appointment_id");

-- CreateIndex
CREATE INDEX "subscription_payment_doctor_id_idx" ON "subscription_payment"("doctor_id");

-- CreateIndex
CREATE INDEX "subscription_payment_plan_id_idx" ON "subscription_payment"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "rating_appointment_id_key" ON "rating"("appointment_id");

-- CreateIndex
CREATE INDEX "rating_doctor_id_idx" ON "rating"("doctor_id");

-- CreateIndex
CREATE INDEX "rating_patient_id_idx" ON "rating"("patient_id");

-- CreateIndex
CREATE INDEX "rating_appointment_id_idx" ON "rating"("appointment_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_profile" ADD CONSTRAINT "patient_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_profile" ADD CONSTRAINT "doctor_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_profile" ADD CONSTRAINT "doctor_profile_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "doctor_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "availability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_report" ADD CONSTRAINT "medical_report_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_payment" ADD CONSTRAINT "appointment_payment_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payment" ADD CONSTRAINT "subscription_payment_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payment" ADD CONSTRAINT "subscription_payment_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "doctor_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patient_profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "rating_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctor_profile"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
