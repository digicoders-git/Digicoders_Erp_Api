export const razorpayWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];

        // Verify webhook signature
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = req.body;

        // Handle payment_link.paid event
        if (event.event === 'payment_link.paid') {
            const paymentLink = event.payload.payment_link.entity;
            const payment = event.payload.payment.entity;

            // Find registration by payment link ID
            const registration = await Registration.findOne({
                paymentLinkId: paymentLink.id
            });

            if (registration) {
                const paymentAmount = payment.amount / 100;

                // Update registration
                registration.paidAmount += paymentAmount;
                registration.dueAmount = Math.max(registration.finalFee - registration.paidAmount, 0);
                registration.tnxStatus = 'paid';
                registration.paymentLinkStatus = 'paid';
                registration.trainingFeeStatus = registration.dueAmount === 0 ? 'full paid' : 'partial';

                await registration.save();

                // Update fee record
                const feeRecord = await Fee.findOne({
                    registrationId: registration._id,
                    paymentLinkId: paymentLink.id,
                    paymentStatus: 'pending'
                });

                if (feeRecord) {
                    feeRecord.tnxId = payment.id;
                    feeRecord.paidAmount = registration.paidAmount;
                    feeRecord.dueAmount = registration.dueAmount;
                    feeRecord.status = 'accepted';
                    feeRecord.tnxStatus = 'paid';
                    feeRecord.paymentStatus = 'success';
                    feeRecord.paymentDate = new Date();
                    feeRecord.isFullPaid = registration.dueAmount === 0;

                    await feeRecord.save();
                }

                // Send confirmation email
                await sendPaymentConfirmationEmail(registration, payment);
            }
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: error.message });
    }
};