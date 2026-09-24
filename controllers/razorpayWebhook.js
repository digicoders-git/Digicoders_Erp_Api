import crypto from "crypto";
import axios from "axios";
import Registration from "../models/regsitration.js";
import Fee from "../models/fee.js";
import { sendPaymentConfirmationEmail } from "../utils/sendEmail.js";

export const razorpayWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];

        let rawBody;
        let event;

        if (Buffer.isBuffer(req.body)) {
            rawBody = req.body.toString('utf8');
            try {
                event = JSON.parse(rawBody);
            } catch (e) {
                event = {};
            }
        } else if (typeof req.body === 'string') {
            rawBody = req.body;
            try {
                event = JSON.parse(rawBody);
            } catch (e) {
                event = {};
            }
        } else {
            rawBody = JSON.stringify(req.body);
            event = req.body;
        }

        // Verify webhook signature if secret is present
        if (secret && signature) {
            const shasum = crypto.createHmac('sha256', secret);
            shasum.update(rawBody);
            const digest = shasum.digest('hex');

            if (digest !== signature) {
                console.error("❌ [Razorpay Webhook] Invalid signature match");
                return res.status(400).json({ error: 'Invalid signature' });
            }
        }

        const PROJECT_REPORT_API = process.env.PROJECT_REPORT_API || "https://apiprojectreport.thedigicoders.com";

        // 1. Handle payment_link.paid event
        if (event.event === 'payment_link.paid') {
            const paymentLink = event.payload?.payment_link?.entity;
            const payment = event.payload?.payment?.entity;

            if (paymentLink && payment) {
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
                    try {
                        await sendPaymentConfirmationEmail(registration, payment);
                    } catch (emailErr) {
                        console.error("Email send error in webhook:", emailErr.message);
                    }
                }
            }
        }

        // 2. Handle order.paid or payment.captured events (including Project Report Security Deposit)
        if (event.event === 'order.paid' || event.event === 'payment.captured') {
            const payment = event.payload?.payment?.entity;
            const order = event.payload?.order?.entity;
            const notes = payment?.notes || order?.notes || {};

            if (notes.type === 'project_report') {
                const payAmount = payment ? (payment.amount / 100) : (order ? (order.amount_paid || order.amount) / 100 : 250);
                const txnId = payment ? payment.id : (order?.id || "");
                let reportId = notes.reportId;

                // Fallback: search student by registrationId / userid if reportId missing in notes
                if (!reportId && (notes.registrationId || notes.userid)) {
                    try {
                        const student = notes.registrationId ? await Registration.findById(notes.registrationId) : null;
                        const searchVal = student?.mobile || student?.email || notes.userid;
                        if (searchVal) {
                            const res = await axios.get(`${PROJECT_REPORT_API}/api/students?search=${searchVal}`);
                            const found = (res.data?.students || []).find(s => s.projectId && s.status !== 'draft');
                            if (found) {
                                reportId = found._id;
                            }
                        }
                    } catch (sErr) {
                        console.error("❌ [Webhook] Error finding student report:", sErr.message);
                    }
                }

                if (reportId) {
                    try {
                        await axios.put(`${PROJECT_REPORT_API}/api/students/${reportId}/status`, {
                            status: "requestForPrint",
                            paymentDetails: {
                                transactionId: txnId,
                                amount: payAmount,
                                status: "success",
                                paidAt: new Date()
                            }
                        });
                        console.log(`✅ [Webhook] Automatically updated project report ${reportId} to requestForPrint`);
                    } catch (prErr) {
                        console.error("❌ [Webhook] Failed to update project report status:", prErr.message);
                    }
                }
            }
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: error.message });
    }
};