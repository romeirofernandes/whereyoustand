import fs from "fs"
import nodemailer from "nodemailer"
import crypto from "crypto"

function base64ToBuffer(b64) {
  return Buffer.from(b64, 'base64')
}

function decryptPayloadBase64Sync(payloadB64, base64Key) {
  if (!base64Key) throw new Error('ENCRYPTION_KEY not set')
  const key = base64ToBuffer(base64Key)
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (base64-encoded)')
  const combined = base64ToBuffer(payloadB64)
  const iv = combined.slice(0, 12)
  const cipherBytes = combined.slice(12)
  if (cipherBytes.length < 16) throw new Error('Invalid ciphertext')
  const authTag = cipherBytes.slice(-16)
  const ciphertext = cipherBytes.slice(0, -16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}

let rawOld = JSON.parse(fs.readFileSync("old.json", "utf8"))
let rawNew = JSON.parse(fs.readFileSync("new.json", "utf8"))
const emailMap = JSON.parse(fs.readFileSync("emailMap.json", "utf8"))

const ENC_KEY = process.env.ENCRYPTION_KEY 

let oldFlat, newFlat
try {
  if (rawOld && rawOld.encrypted && rawOld.payload) {
    if (!ENC_KEY) throw new Error('ENCRYPTED old.json but ENCRYPTION_KEY not set in env')
    oldFlat = decryptPayloadBase64Sync(rawOld.payload, ENC_KEY)
  } else {
    oldFlat = rawOld
  }

  if (rawNew && rawNew.encrypted && rawNew.payload) {
    if (!ENC_KEY) throw new Error('ENCRYPTED new.json but ENCRYPTION_KEY not set in env')
    newFlat = decryptPayloadBase64Sync(rawNew.payload, ENC_KEY)
  } else {
    newFlat = rawNew
  }
} catch (err) {
  console.error('Failed to decrypt snapshots:', err.message)
  process.exit(1)
}

console.log("============================================================")
console.log("MARKS COMPARISON REPORT")
console.log("============================================================")
console.log(`Old marks records: ${oldFlat.length}`)
console.log(`New marks records: ${newFlat.length}`)
console.log(`Email map entries: ${Object.keys(emailMap).length}`)
console.log("============================================================")

function group(flat) {
  const out = {}
  for (const row of flat) {
    const { prn, subject, exam_type, marks } = row

    if (!out[prn]) out[prn] = {}
    if (!out[prn][subject]) out[prn][subject] = {}

    out[prn][subject][exam_type] = marks
  }
  return out
}

const oldMarks = group(oldFlat)
const newMarks = group(newFlat)

async function sendMail(to, prn, subject, examType, oldVal, newVal) {
  const t = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USERNAME,
      pass: process.env.GMAIL_PASSWORD
    }
  })

  const isNewEntry = oldVal === null
  
  const html = `
<div style="background: #1a1423; padding: 48px 24px; font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; background: #231b2b; border-radius: 12px; border: 1px solid #3d2f48; box-shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 8px 10px -1px hsl(0 0% 0% / 0.10); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #a52847, #c64864); padding: 32px 40px; text-align: center;">
      <img src="https://whereyoustand.vercel.app/logo.png" alt="Where You Stand" style="width: 56px; height: 56px; margin-bottom: 16px; border-radius: 12px;" />
      <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">Where You Stand</h1>
      <p style="margin: 10px 0 0; font-size: 15px; font-weight: 500; color: #f0b8c3; opacity: 0.95;">Your marks have been updated</p>
    </div>
    <div style="padding: 32px 40px;">
      <p style="font-size: 16px; color: #d8b5c5; margin: 0 0 24px; line-height: 1.6;">
        Hey there! You have a new score you have to check out.
      </p>
      <div style="background: #1a1423; border: 1px solid #3d2f48; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <div style="display: table; width: 100%; font-size: 15px;">
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 10px 16px 10px 0; color: #c79dae; font-weight: 500;">PRN</div>
            <div style="display: table-cell; padding: 10px 0; color: #d9bbc7; font-weight: 600; text-align: right;">${prn}</div>
          </div>
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 10px 16px 10px 0; color: #c79dae; font-weight: 500; border-top: 1px solid #3d2f48;">Subject</div>
            <div style="display: table-cell; padding: 10px 0; color: #d9bbc7; font-weight: 600; text-align: right; border-top: 1px solid #3d2f48;">${subject}</div>
          </div>
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 10px 16px 10px 0; color: #c79dae; font-weight: 500; border-top: 1px solid #3d2f48;">Exam Type</div>
            <div style="display: table-cell; padding: 10px 0; color: #d9bbc7; font-weight: 600; text-align: right; border-top: 1px solid #3d2f48;">${examType}</div>
          </div>
        </div>
      </div>
      ${isNewEntry ? `
      <div style="padding: 20px; background: linear-gradient(135deg, #a52847, #c64864); border-radius: 8px; text-align: center; border: 1px solid #c64864; margin-bottom: 28px;">
        <div style="font-size: 13px; color: #ffffff; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9;">Marks</div>
        <div style="font-size: 32px; font-weight: 800; color: #ffffff;">${newVal}</div>
      </div>
      ` : `
      <div style="display: table; width: 100%; margin-bottom: 28px;">
        <div style="display: table-cell; width: 48%; padding: 20px; background: #1a1423; border: 1px solid #3d2f48; border-radius: 8px; text-align: center;">
          <div style="font-size: 13px; color: #c79dae; margin-bottom: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Previous</div>
          <div style="font-size: 32px; font-weight: 700; color: #d8b5c5;">${oldVal}</div>
        </div>
        <div style="display: table-cell; width: 4%;"></div>
        <div style="display: table-cell; width: 48%; padding: 20px; background: linear-gradient(135deg, #a52847, #c64864); border-radius: 8px; text-align: center; border: 1px solid #c64864;">
          <div style="font-size: 13px; color: #ffffff; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9;">Current</div>
          <div style="font-size: 32px; font-weight: 800; color: #ffffff;">${newVal}</div>
        </div>
      </div>
      `}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0;">
        <tr>
          <td>
            <a href="https://whereyoustand.vercel.app" style="display: block; background: linear-gradient(135deg, #a52847, #c64864); color: #ffffff; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; text-align: center; box-shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.10), 0 2px 4px -1px hsl(0 0% 0% / 0.10); letter-spacing: -0.01em;">
              View Full Dashboard →
            </a>
          </td>
        </tr>
      </table>
    </div>
    <div style="background: #1a1423; border-top: 1px solid #3d2f48; color: #c79dae; text-align: center; font-size: 13px; padding: 20px 40px;">
      <p style="margin: 0;">Powered by <span style="font-weight: 600; color: #d8b5c5;">Where You Stand</span></p>
    </div>
  </div>
</div>
`

  const text = `Hey, You have a new score you have to check out.

PRN: ${prn}
Subject: ${subject}
Exam Type: ${examType}
${isNewEntry ? `Marks: ${newVal}` : `Old Marks: ${oldVal}\nNew Marks: ${newVal}`}
`

  try {
    await t.sendMail({
      from: process.env.GMAIL_USERNAME,
      to,
      subject: "Marks updated",
      text,
      html
    })
    console.log(`Email sent to ${to}`)
  } catch (error) {
    console.error(`Failed to send email to ${to}: ${error.message}`)
  }
}

async function run() {
  let changesFound = 0
  let emailsSent = 0

  console.log("\n============================================================")
  console.log("SCANNING FOR CHANGES")
  console.log("============================================================")

  for (const prn of Object.keys(newMarks)) {
    const email = emailMap[prn]
    const oldP = oldMarks[prn] || {}
    const newP = newMarks[prn]

    let studentHasChanges = false

    for (const subject of Object.keys(newP)) {
      for (const examType of Object.keys(newP[subject])) {
        const newVal = newP[subject][examType]

        const oldVal =
          oldP[subject] && oldP[subject][examType] !== undefined
            ? oldP[subject][examType]
            : null

        const isNewEntry =
          oldP[subject] === undefined ||
          oldP[subject][examType] === undefined

        const isChanged = newVal !== oldVal

        if (isNewEntry || isChanged) {
          if (!studentHasChanges) {
            console.log(`\nPRN: ${prn}`)
            console.log(`Email: ${email || "none"}`)
            studentHasChanges = true
          }

          console.log(`  ${subject}  -  ${examType}`)
          console.log(`    Old: ${oldVal === null ? "null" : oldVal}`)
          console.log(`    New: ${newVal}`)
          console.log(`    Status: ${isNewEntry ? "NEW ENTRY" : "UPDATED"}`)

          changesFound++

          if (email) {
            await sendMail(email, prn, subject, examType, oldVal, newVal)
            emailsSent++
          } else {
            console.log("    No email configured for this student")
          }
        }
      }
    }
  }

  console.log("\n============================================================")
  console.log("SUMMARY")
  console.log("============================================================")
  console.log(`Total changes found: ${changesFound}`)
  console.log(`Emails sent: ${emailsSent}`)

  if (changesFound === 0) {
    console.log("No changes detected")
  }

  console.log("============================================================")
}

run().catch(err => {
  console.error("\nError:", err)
  process.exit(1)
})
