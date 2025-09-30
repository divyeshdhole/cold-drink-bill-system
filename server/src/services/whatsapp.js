import fetch from 'node-fetch'

export async function sendWhatsAppDocument({ toPhone, documentUrl, caption }){
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if(!token || !phoneNumberId) throw new Error('WhatsApp not configured')

  const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'document',
    document: { link: documentUrl, caption: caption || '' }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()
  if(!res.ok){
    throw new Error(`WhatsApp send failed: ${res.status} ${JSON.stringify(data)}`)
  }
  return data
}


export async function sendWhatsAppImage({ toPhone, imageUrl, caption }){
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if(!token || !phoneNumberId) throw new Error('WhatsApp not configured')

  const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'image',
    image: { link: imageUrl, caption: caption || '' }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()
  if(!res.ok){
    throw new Error(`WhatsApp send failed: ${res.status} ${JSON.stringify(data)}`)
  }
  return data
}
