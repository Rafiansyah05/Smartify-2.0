import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
  email: string,
  code: string,
  nama: string,
) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL || "Smartify <noreply@pradatelyu.online> ",
      to: email,
      subject: "Verifikasi Email Smartify - Kode OTP Anda",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Poppins', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 0;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <!-- Header with Logo -->
            <div style="background: linear-gradient(135deg, #4ac9ff 0%, #2d9cdb 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Smartify</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Platform Generate Quiz Digital</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 25px;">
              <h2 style="color: #1a1a1a; margin-top: 0;">Halo, ${nama}!</h2>
              <p style="color: #4a5568; line-height: 1.6;">Terima kasih telah mendaftar di <strong>Smartify</strong>. Gunakan kode verifikasi di bawah ini untuk mengaktifkan akun Anda:</p>
              
              <!-- Verification Code Box -->
              <div style="background-color: #f0f9ff; border: 2px dashed #4ac9ff; border-radius: 16px; padding: 20px; text-align: center; margin: 25px 0;">
                <div style="font-size: 42px; letter-spacing: 12px; font-weight: bold; color: #2d9cdb; font-family: monospace;">
                  ${code}
                </div>
                <p style="color: #718096; margin: 12px 0 0; font-size: 12px;">Kode ini bersifat rahasia, jangan bagikan ke siapa pun</p>
              </div>
              
              <div style="background-color: #fff3e0; border-radius: 12px; padding: 15px; margin: 20px 0;">
                <p style="color: #e67e22; margin: 0; font-size: 14px;">
                  Kode ini akan kadaluarsa dalam <strong>15 menit</strong>
                </p>
              </div>
              
              <p style="color: #4a5568; line-height: 1.6;">
                Jika Anda tidak merasa mendaftar di Smartify, abaikan email ini. Tidak perlu melakukan tindakan apapun.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f5f7fa; padding: 20px 25px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #a0aec0; margin: 0; font-size: 12px;">
                &copy; 2024 Smartify - Platform Generate Quiz Digital<br>
                Membantu Guru Membuat Soal dengan Mudah
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Gagal mengirim email verifikasi");
  }
}

export async function sendPasswordResetEmail(
  email: string,
  nama: string,
  resetUrl: string,
) {
  const from = (
    process.env.FROM_EMAIL || "Smartify <noreply@pradatelyu.online>"
  ).trim();

  try {
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: "Atur ulang password akun Smartify Anda",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Poppins', Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 24px 0;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
            <div style="background: linear-gradient(135deg, #4ac9ff 0%, #2d9cdb 100%); padding: 28px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px;">Smartify</h1>
              <p style="color: rgba(255,255,255,0.92); margin: 8px 0 0; font-size: 14px;">Platform generate kuis digital untuk pengajar</p>
            </div>
            <div style="padding: 32px 28px;">
              <p style="color: #1a1a1a; margin: 0 0 16px; font-size: 16px;">Halo <strong>${escapeHtml(nama)}</strong>,</p>
              <p style="color: #4a5568; line-height: 1.65; margin: 0 0 16px; font-size: 15px;">
                Kami menerima permintaan untuk mengatur ulang password akun Smartify yang terhubung dengan alamat email ini.
              </p>
              <p style="color: #4a5568; line-height: 1.65; margin: 0 0 16px; font-size: 15px;">
                Untuk keamanan Anda, tautan di bawah hanya dapat digunakan dalam waktu terbatas dan akan menjadi tidak berlaku setelah password berhasil diubah.
              </p>
              <ul style="color: #4a5568; line-height: 1.65; margin: 0 0 20px; padding-left: 20px; font-size: 14px;">
                <li>Jika Anda yang meminta reset, silakan klik tombol di bawah.</li>
                <li>Jika Anda tidak meminta perubahan ini, abaikan email ini—akun Anda tetap aman.</li>
                <li>Jangan bagikan tautan ini kepada siapa pun.</li>
              </ul>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 28px auto;">
                <tr>
                  <td style="border-radius: 12px; background: linear-gradient(135deg, #4ac9ff 0%, #2d9cdb 100%);">
                    <a href="${escapeAttr(resetUrl)}" target="_blank" rel="noopener noreferrer"
                      style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 12px;">
                      Atur password baru
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
                Tombol tidak berfungsi? Salin dan tempel tautan berikut ke peramban Anda:
              </p>
              <p style="color: #2d9cdb; font-size: 12px; word-break: break-all; margin: 0;">${escapeHtml(resetUrl)}</p>
              <p style="color: #a0aec0; font-size: 12px; margin: 24px 0 0;">Tautan berlaku selama 1 jam.</p>
            </div>
            <div style="background-color: #f5f7fa; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #a0aec0; margin: 0; font-size: 12px; line-height: 1.5;">
                Email ini dikirim otomatis; mohon tidak membalas langsung ke alamat ini.<br />
                &copy; Smartify — membantu guru membuat soal dengan mudah
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Password reset email failed:", error);
    throw new Error("Gagal mengirim email atur ulang password");
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(url: string): string {
  return url
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
