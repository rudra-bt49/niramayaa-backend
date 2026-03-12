import prisma from '../../prisma/prisma';
import { BookAppointmentReqBody } from './appointment.types';
import { stripeService } from '../../shared/services/stripe.service';
import { cloudinaryService } from '../../shared/services/cloudinary.service';
import { AppointmentStatus } from '@prisma/client';
import { convertISTToUTC } from '../../shared/utils/timezone';

export const appointmentService = {
    initiateBookingSession: async (params: {
        userId: string;
        body: BookAppointmentReqBody;
        files: Express.Multer.File[];
    }): Promise<string | null> => {
        const { userId, body, files } = params;

        // 1. Validate the user/patient
        const patient = await prisma.user.findUnique({
            where: { id: userId },
            include: { patient_profile: true }
        });
        if (!patient || !patient.patient_profile) {
            throw new Error('Patient profile not found');
        }

        // 2. Validate the doctor
        const doctor = await prisma.user.findUnique({
            where: { id: body.doctor_id },
            include: { doctor_profile: true }
        });
        if (!doctor || !doctor.doctor_profile) {
            throw new Error('Doctor profile not found');
        }

        // 3. Find/Validate Availability
        const availability = await prisma.availability.findUnique({
            where: { id: body.availability_id }
        });

        if (!availability) {
            throw new Error('No valid availability found for this slot');
        }

        // 4. Convert requested start_at and end_at (IST) to UTC Dates using availability's date
        const startAtUtc = convertISTToUTC(body.start_at, availability.start_at);
        const endAtUtc = convertISTToUTC(body.end_at, availability.start_at);

        // 5. Validation: start_at must be in the future
        const now = new Date();
        if (startAtUtc <= now) {
            throw new Error('Appointment must be booked for a future time');
        }

        // 6. Validation: Duration must match slot_duration
        const durationInMins = Math.round((endAtUtc.getTime() - startAtUtc.getTime()) / 60000);
        if (durationInMins !== availability.slot_duration) {
            throw new Error(`Slot duration (${durationInMins} mins) does not match doctor's expected slot duration of ${availability.slot_duration} mins`);
        }

        // 7. Ensure the slot is not already booked
        // We check if any SCHEDULED appointment for this doctor has the EXACT same start_at
        const existingAppointment = await prisma.appointment.findFirst({
            where: {
                doctor_id: body.doctor_id,
                status: AppointmentStatus.SCHEDULED,
                start_at: startAtUtc,
            }
        });

        if (existingAppointment) {
            throw new Error('This slot is already booked');
        }

        // 8. Upload medical reports to Cloudinary
        const uploadedReports: { secure_url: string; public_id: string }[] = [];
        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    const result = await cloudinaryService.uploadImageStream(file.buffer, 'medical_reports');
                    uploadedReports.push(result);
                } catch (error) {
                    console.error('File upload failed', error);
                }
            }
        }

        // 9. Create Stripe Checkout Session
        // Stripe minimum expiry is 30 minutes. We'll set it to 30 minutes from now.
        const expiresAt = Math.floor(Date.now() / 1000) + (30 * 60);

        const session = await stripeService.createAppointmentCheckoutSession({
            patientEmail: patient.email,
            doctorName: `Dr. ${doctor.first_name} ${doctor.last_name}`,
            amount: doctor.doctor_profile.consultation_fee,
            successUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/appointment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/appointment/cancel`,
            expiresAt,
            metadata: {
                registration_type: 'APPOINTMENT_BOOKING',
                patient_id: patient.id,
                doctor_id: body.doctor_id,
                availability_id: availability.id,
                start_at: startAtUtc.toISOString(),
                end_at: endAtUtc.toISOString(),
                name: body.name,
                email: body.email,
                phone: body.phone,
                height: body.height.toString(),
                weight: body.weight.toString(),
                gender: body.gender,
                blood_group: body.blood_group,
                description: body.description ?? '',
                medical_reports: JSON.stringify(uploadedReports),
            }
        });

        return session.url;
    }
};
