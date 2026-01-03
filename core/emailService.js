// core/emailService.js
const { Resend } = require('resend');

class EmailService {
    constructor() {
        this.resend = new Resend(process.env.RESEND_API_KEY || 're_KLNiEivw_CKWPC6uskbxrNP1n2chKVBv2');
        this.from = process.env.EMAIL_FROM || 'ShadowCore <noreply@shadowcore.app>';
    }

    async sendVerificationEmail(to, token, username) {
        try {
            const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/verify/${token}`;
            
            const { data, error } = await this.resend.emails.send({
                from: this.from,
                to: [to],
                subject: 'Verify Your ShadowCore Account',
                html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 ShadowCore</h1>
            <p>Universal Plugin Platform</p>
        </div>
        <div class="content">
            <h2>Welcome, ${username}!</h2>
            <p>Thank you for registering with ShadowCore. To activate your account, please verify your email address by clicking the button below:</p>
            
            <center>
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </center>
            
            <p>Or copy and paste this link in your browser:</p>
            <p><code>${verificationUrl}</code></p>
            
            <p>This verification link will expire in 24 hours.</p>
            
            <p>If you didn't create an account with ShadowCore, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ShadowCore. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
        </div>
    </div>
</body>
</html>
                `
            });

            if (error) {
                console.error('Email sending error:', error);
                return false;
            }

            console.log(`📧 Verification email sent to ${to}`);
            return true;
        } catch (error) {
            console.error('Email service error:', error);
            return false;
        }
    }

    async sendWelcomeEmail(to, username) {
        try {
            const { data, error } = await this.resend.emails.send({
                from: this.from,
                to: [to],
                subject: 'Welcome to ShadowCore!',
                html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #667eea; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Welcome to ShadowCore!</h1>
            <p>Your account is now verified and ready</p>
        </div>
        <div class="content">
            <h2>Hello ${username},</h2>
            <p>Your ShadowCore account has been successfully verified! You can now access all features:</p>
            
            <div class="feature">
                <strong>🧩 Plugin System</strong>
                <p>Install and manage unlimited plugins</p>
            </div>
            
            <div class="feature">
                <strong>🎨 Custom Themes</strong>
                <p>Choose from multiple theme options</p>
            </div>
            
            <div class="feature">
                <strong>⚡ AI Tools</strong>
                <p>Access powerful AI-powered features</p>
            </div>
            
            <center>
                <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">
                    Go to Dashboard
                </a>
            </center>
            
            <p>Need help? Check out our documentation or contact support.</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} ShadowCore. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
                `
            });

            return !error;
        } catch (error) {
            console.error('Welcome email error:', error);
            return false;
        }
    }
}

module.exports = EmailService;
