import * as dotenv from 'dotenv';
import { Twilio } from 'twilio';
dotenv.config();

const client = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function test() {
    try {
        await client.messages.create({
            body: "Test SMS",
            from: process.env.TWILIO_PHONE_NUMBER,
            to: "+880787510076"
        });
        console.log("Success");
    } catch (e) {
        console.error("Twilio Error:", e.message);
    }
}
test();
