import cloudinary from '../../config/cloudinary.config';

export const cloudinaryService = {
    /**
     * Upload an image buffer to Cloudinary using a stream.
     * @param fileBuffer The buffer containing the image data.
     * @param folder The folder in Cloudinary.
     * @returns A promise resolving to an object containing secure_url and public_id.
     */
    uploadImageStream: (fileBuffer: Buffer, folder: string): Promise<{ secure_url: string; public_id: string }> => {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'auto',
                },
                (error, result) => {
                    if (error) {
                        return reject(error);
                    }
                    if (!result) {
                        return reject(new Error('Cloudinary upload returned no result'));
                    }
                    resolve({
                        secure_url: result.secure_url,
                        public_id: result.public_id,
                    });
                }
            );

            // Write the buffer to the stream and end it
            uploadStream.end(fileBuffer);
        });
    },

    /**
     * Delete an image from Cloudinary by its public_id.
     * @param publicId The public_id of the image to delete.
     */
    deleteImage: async (publicId: string): Promise<void> => {
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            console.error(`Failed to delete Cloudinary image with public_id ${publicId}:`, error);
        }
    },
};
