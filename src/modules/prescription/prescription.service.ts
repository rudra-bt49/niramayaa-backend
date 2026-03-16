import prisma from '../../prisma/prisma';
import { ICreatePrescriptionRequest, IUpdatePrescriptionRequest } from './prescription.validator';
import { AppointmentStatus } from '@prisma/client';
import emailService from '../../shared/services/email.service';

export const prescriptionService = {
    /**
     * Create a new prescription for an appointment
     */
    createPrescription: async (doctorId: string, appointmentId: string, data: ICreatePrescriptionRequest): Promise<any> => {
        // 1. Fetch appointment with details
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: {
                patient: {
                    include: {
                        user: {
                            select: {
                                email: true,
                                first_name: true,
                                last_name: true
                            }
                        }
                    }
                },
                doctor: {
                    include: {
                        user: {
                            select: {
                                first_name: true,
                                last_name: true
                            }
                        }
                    }
                }
            }
        });

        if (!appointment) {
            const error: any = new Error("Appointment not found");
            error.statusCode = 404;
            throw error;
        }

        // 2. Ownership check
        if (appointment.doctor_id !== doctorId) {
            const error: any = new Error("You are not authorized to create a prescription for this appointment");
            error.statusCode = 403;
            throw error;
        }

        // 3. Status and Ongoing check
        const now = new Date();
        const isOngoing = appointment.status === AppointmentStatus.SCHEDULED && appointment.start_at <= now && appointment.end_at >= now;
        const isCompleted = appointment.status === AppointmentStatus.COMPLETED;

        if (!isOngoing && !isCompleted) {
            const error: any = new Error("Prescription can only be created for ongoing or completed appointments");
            error.statusCode = 400;
            throw error;
        }

        // 4. Duplicate check
        const existingPrescription = await prisma.prescription.findUnique({
            where: { appointment_id: appointmentId }
        });
        if (existingPrescription) {
            const error: any = new Error("Prescription already exists for this appointment. Use update instead.");
            error.statusCode = 400;
            throw error;
        }

        // 5. Create Prescription & Items in Transaction
        const result = await prisma.$transaction(async (tx) => {
            const prescription = await tx.prescription.create({
                data: {
                    appointment_id: appointmentId,
                    items: {
                        create: data.items.map(item => ({
                            medicine_name: item.medicine_name,
                            dosage_value: item.dosage_value,
                            dosage_unit: item.dosage_unit,
                            morning: item.morning,
                            afternoon: item.afternoon,
                            night: item.night,
                            timing: item.timing,
                            total_quantity: item.total_quantity,
                            note: item.note
                        }))
                    }
                },
                include: {
                    items: true
                }
            });

            return prescription;
        });

        // 6. Send Email (Async)
        const patientName = `${appointment.patient.user.first_name} ${appointment.patient.user.last_name}`;
        const doctorName = `${appointment.doctor.user.first_name} ${appointment.doctor.user.last_name}`;

        emailService.sendPrescriptionEmail(
            appointment.patient.user.email,
            patientName,
            doctorName,
            data.items
        ).catch(err => console.error("Failed to send prescription email:", err));

        return result;
    },

    /**
     * Update an existing prescription
     */
    updatePrescription: async (doctorId: string, appointmentId: string, data: IUpdatePrescriptionRequest): Promise<any> => {
        // 1. Fetch prescription with appointment details
        const existingPrescription = await prisma.prescription.findUnique({
            where: { appointment_id: appointmentId },
            include: {
                appointment: {
                    include: {
                        patient: {
                            include: {
                                user: {
                                    select: {
                                        email: true,
                                        first_name: true,
                                        last_name: true
                                    }
                                }
                            }
                        },
                        doctor: {
                            include: {
                                user: {
                                    select: {
                                        first_name: true,
                                        last_name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!existingPrescription) {
            const error: any = new Error("Prescription not found for this appointment");
            error.statusCode = 404;
            throw error;
        }

        // 2. Ownership check
        if (existingPrescription.appointment.doctor_id !== doctorId) {
            const error: any = new Error("You are not authorized to update this prescription");
            error.statusCode = 403;
            throw error;
        }

        // 3. Transactional Update (Delete items and Create new ones)
        const result = await prisma.$transaction(async (tx) => {
            // Delete all current items
            await tx.prescription_item.deleteMany({
                where: { prescription_id: existingPrescription.id }
            });

            // Create new items
            const updatedPrescription = await tx.prescription.update({
                where: { id: existingPrescription.id },
                data: {
                    items: {
                        create: data.items.map(item => ({
                            medicine_name: item.medicine_name,
                            dosage_value: item.dosage_value,
                            dosage_unit: item.dosage_unit,
                            morning: item.morning,
                            afternoon: item.afternoon,
                            night: item.night,
                            timing: item.timing,
                            total_quantity: item.total_quantity,
                            note: item.note
                        }))
                    }
                },
                include: {
                    items: true
                }
            });

            return updatedPrescription;
        });

        // 4. Send Updated Email (Async)
        const patientName = `${existingPrescription.appointment.patient.user.first_name} ${existingPrescription.appointment.patient.user.last_name}`;
        const doctorName = `${existingPrescription.appointment.doctor.user.first_name} ${existingPrescription.appointment.doctor.user.last_name}`;

        emailService.sendUpdatedPrescriptionEmail(
            existingPrescription.appointment.patient.user.email,
            patientName,
            doctorName,
            data.items
        ).catch(err => console.error("Failed to send updated prescription email:", err));

        return result;
    },

    /**
     * Get prescription details for an appointment
     */
    getPrescription: async (userId: string, appointmentId: string): Promise<any> => {
        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: {
                prescription: {
                    include: {
                        items: true
                    }
                }
            }
        });

        if (!appointment) {
            const error: any = new Error("Appointment not found");
            error.statusCode = 404;
            throw error;
        }

        // Authorization check
        if (appointment.patient_id !== userId && appointment.doctor_id !== userId) {
            const error: any = new Error("You are not authorized to view this prescription");
            error.statusCode = 403;
            throw error;
        }

        if (!appointment.prescription) {
            const error: any = new Error("Prescription not found for this appointment");
            error.statusCode = 404;
            throw error;
        }

        return appointment.prescription;
    }
};
