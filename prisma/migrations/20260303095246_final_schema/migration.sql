/*
  Warnings:

  - Added the required column `gender` to the `appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "DosageUnit" AS ENUM ('TABLET', 'CAPSULE', 'ML', 'MG', 'DROPS', 'TEASPOON', 'TABLESPOON', 'PUFF', 'PATCH', 'SACHET', 'BOTTLE', 'TUBE', 'INJECTION');

-- CreateEnum
CREATE TYPE "MealTiming" AS ENUM ('BEFORE_MEAL', 'AFTER_MEAL', 'WITH_MEAL');

-- CreateEnum
CREATE TYPE "IndianCity" AS ENUM ('MUMBAI', 'PUNE', 'NAGPUR', 'NASHIK', 'AURANGABAD', 'SOLAPUR', 'KOLHAPUR', 'THANE', 'NAVI_MUMBAI', 'AMRAVATI', 'NEW_DELHI', 'GURGAON', 'NOIDA', 'FARIDABAD', 'GHAZIABAD', 'BENGALURU', 'MYSURU', 'HUBLI', 'MANGALURU', 'BELGAUM', 'CHENNAI', 'COIMBATORE', 'MADURAI', 'TIRUCHIRAPPALLI', 'SALEM', 'HYDERABAD', 'WARANGAL', 'NIZAMABAD', 'VISAKHAPATNAM', 'VIJAYAWADA', 'GUNTUR', 'AHMEDABAD', 'SURAT', 'VADODARA', 'RAJKOT', 'BHAVNAGAR', 'NADIAD', 'JAIPUR', 'JODHPUR', 'UDAIPUR', 'KOTA', 'AJMER', 'LUCKNOW', 'KANPUR', 'AGRA', 'VARANASI', 'ALLAHABAD', 'MEERUT', 'KOLKATA', 'HOWRAH', 'DURGAPUR', 'ASANSOL', 'LUDHIANA', 'AMRITSAR', 'JALANDHAR', 'BHOPAL', 'INDORE', 'GWALIOR', 'JABALPUR', 'PATNA', 'GAYA', 'BHAGALPUR', 'BHUBANESWAR', 'CUTTACK', 'ROURKELA', 'GUWAHATI', 'DIBRUGARH', 'RANCHI', 'JAMSHEDPUR', 'DHANBAD', 'RAIPUR', 'BHILAI', 'CHANDIGARH', 'AMBALA', 'ROHTAK', 'SHIMLA', 'DHARAMSHALA', 'DEHRADUN', 'HARIDWAR', 'ROORKEE', 'PANAJI', 'MARGAO', 'THIRUVANANTHAPURAM', 'KOCHI', 'KOZHIKODE', 'THRISSUR', 'SRINAGAR', 'JAMMU', 'IMPHAL', 'SHILLONG', 'AIZAWL', 'KOHIMA', 'AGARTALA', 'ITANAGAR', 'GANGTOK');

-- AlterTable
ALTER TABLE "appointment" ADD COLUMN     "gender" "Gender" NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "gender" "Gender" NOT NULL,
DROP COLUMN "city",
ADD COLUMN     "city" "IndianCity" NOT NULL;

-- CreateTable
CREATE TABLE "prescription" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_item" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "medicine_name" TEXT NOT NULL,
    "dosage_value" DOUBLE PRECISION NOT NULL,
    "dosage_unit" "DosageUnit" NOT NULL,
    "morning" BOOLEAN NOT NULL DEFAULT false,
    "afternoon" BOOLEAN NOT NULL DEFAULT false,
    "night" BOOLEAN NOT NULL DEFAULT false,
    "timing" "MealTiming" NOT NULL,
    "total_quantity" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescription_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prescription_appointment_id_key" ON "prescription"("appointment_id");

-- CreateIndex
CREATE INDEX "prescription_item_prescription_id_idx" ON "prescription_item"("prescription_id");

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_item" ADD CONSTRAINT "prescription_item_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
