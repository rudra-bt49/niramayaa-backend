import cron from 'node-cron';
import prisma from '../prisma/prisma';
import { doctorService } from '../modules/doctor/doctor.service';

/**
 * Creates availability for all doctors dynamically up to 30 days ahead.
 */
const runDoctorAvailabilityCron = async () => {
    console.log(`[CRON] Generating Doctor Availability - Run Started at ${new Date().toISOString()}`);

    try {
        // 1. Fetch all doctors
        const doctors = await prisma.doctor_profile.findMany({
             select: { user_id: true }
        });

        console.log(`[CRON] Found ${doctors.length} doctors. Processing availability...`);

        // 2. Iterate and generate availability dynamically using existing function
        let processedCount = 0;
        
        for (const doctor of doctors) {
            try {
                // Remove the initial verification block inside `createDefaultAvailability` and process logic
                const availabilities = [];
                const slot_duration = 20;
                const queue_capacity = 21;

                const now = new Date();
                let daysAdded = 0;
                let dayOffset = 0;

                while (daysAdded < 30) {
                    const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
                    
                    const istTime = new Date(targetDate.getTime() + (5.5 * 60 * 60 * 1000));
                    const dayOfWeek = istTime.getUTCDay(); // 0 is Sunday
                    
                    const year = istTime.getUTCFullYear();
                    const month = istTime.getUTCMonth();
                    const date = istTime.getUTCDate();

                    const createUtcFromIst = (hour: number, minute: number) => {
                        const tempIst = new Date(Date.UTC(year, month, date, hour, minute, 0, 0));
                        return new Date(tempIst.getTime() - (5.5 * 60 * 60 * 1000));
                    };

                    const start_at = createUtcFromIst(9, 0); 
                    const end_at = createUtcFromIst(17, 0); 
                    const break_start = createUtcFromIst(13, 0); 
                    const break_end = createUtcFromIst(14, 0); 

                    availabilities.push({
                        doctor_id: doctor.user_id,
                        start_at,
                        end_at,
                        break_start,
                        break_end,
                        slot_duration,
                        is_active: dayOfWeek !== 0,
                        queue_capacity
                    });
                    
                    daysAdded++;
                    dayOffset++;
                }

                if (availabilities.length > 0) {
                    const result = await prisma.availability.createMany({
                        data: availabilities,
                        skipDuplicates: true
                    });
                    processedCount++;
                }
            } catch (err) {
                 console.error(`[CRON] Error generating availability for Doctor ID ${doctor.user_id}:`, err);
            }
        }

        console.log(`[CRON] Success! Processed scheduling for ${processedCount} doctors.`);

    } catch (error) {
         console.error('[CRON] High-Level Failure generating doctor availabilities:', error);
    }
}

// -----------------------------------------------------
// TEST SCHEDULE: Runs EVERY MINUTE
// CHANGE THIS TO: '0 0 * * *' (Daily UTC Midnight) when done testing
// -----------------------------------------------------
cron.schedule('0 0 * * *', () => {
    runDoctorAvailabilityCron();
}, {
    timezone: "UTC"
});
