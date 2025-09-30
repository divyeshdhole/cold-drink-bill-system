import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

function money(n){ return (Number(n||0)).toFixed(2) }

export async function generateInvoicePDFBuffer({ business, invoice, upi }) {
  const qrText = upi?.vpa && invoice?.total
    ? `upi://pay?pa=${encodeURIComponent(upi.vpa)}&pn=${encodeURIComponent(upi.name||business?.name||'')}&am=${invoice.total}&cu=${upi.currency||'INR'}`
    : ''

  const qrPng = qrText ? await QRCode.toBuffer(qrText, { type: 'png', width: 300 }) : null

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size:'A4', margin: 36 })
      const chunks = []
      doc.on('data', (c)=> chunks.push(c))
      doc.on('end', ()=> resolve(Buffer.concat(chunks)))

      // ===== HEADER =====
      doc.font('Helvetica-Bold').fontSize(20).text(business?.name || 'Shop', { align:'center' })
      doc.moveDown(0.3)
      if (business?.address) doc.font('Helvetica').fontSize(10).text(business.address, { align:'center' })
      if (business?.phone) doc.text(`Phone: ${business.phone}`, { align:'center' })
      if (business?.gstin) doc.text(`GSTIN: ${business.gstin}`, { align:'center' })

      doc.moveDown(1)
      doc.moveTo(36, doc.y).lineTo(560, doc.y).stroke()
      doc.moveDown(0.5)

      // ===== INVOICE META =====
      doc.fontSize(12)
      doc.text(`Invoice No: ${invoice.number}`, 36, doc.y)
      doc.text(`Date: ${new Date(invoice.createdAt || Date.now()).toLocaleDateString('en-IN')}`, 400, doc.y)
      doc.moveDown(0.5)
      if (invoice.customerName) doc.text(`Customer: ${invoice.customerName}`, 36)
      if (invoice.customerPhone) doc.text(`Phone: ${invoice.customerPhone}`, 400)
      if (invoice.customerAddress) doc.text(`Address: ${invoice.customerAddress}`, 36, doc.y, { width: 500 })
      doc.moveDown(1)

      // ===== ITEMS TABLE HEADER =====
      const tableTop = doc.y
      const col = { item: 36, qty: 300, price: 360, tax: 430, total: 500 }

      doc.font('Helvetica-Bold')
      doc.text('Item', col.item, tableTop)
      doc.text('Qty', col.qty, tableTop)
      doc.text('Price', col.price, tableTop)
      doc.text('Tax %', col.tax, tableTop)
      doc.text('Line Total', col.total, tableTop)

      doc.moveTo(36, tableTop + 15).lineTo(560, tableTop + 15).stroke()
      doc.font('Helvetica')

      // ===== ITEMS =====
      invoice.items.forEach((it) => {
        const y = doc.y + 5
        doc.text(it.nameSnapshot, col.item, y)
        doc.text(String(it.qty), col.qty, y)
        doc.text(money(it.unitPrice), col.price, y)
        doc.text(String(it.taxPercent || 0), col.tax, y)
        doc.text(money(it.lineTotal), col.total, y)
        doc.moveDown(1)
      })

      doc.moveTo(36, doc.y).lineTo(560, doc.y).stroke()

      // ===== TOTALS =====
      doc.moveDown(0.5)
      doc.fontSize(12)
      doc.text(`Sub Total: ₹${money(invoice.subTotal)}`, 400, doc.y, { align: 'right' })
      doc.text(`Tax: ₹${money(invoice.taxTotal)}`, 400, doc.y, { align: 'right' })
      if (invoice.discount) doc.text(`Discount: -₹${money(invoice.discount)}`, 400, doc.y, { align: 'right' })
      if (invoice.rounding) doc.text(`Rounding: ₹${money(invoice.rounding)}`, 400, doc.y, { align: 'right' })
      doc.font('Helvetica-Bold').text(`TOTAL: ₹${money(invoice.total)}`, 400, doc.y, { align: 'right' })
      doc.font('Helvetica')

      doc.moveDown(1)

      // ===== QR CODE =====
      if (qrPng) {
        const y = doc.y
        doc.image(qrPng, 36, y, { width: 120 })
        doc.fontSize(10).text(
          `Scan to Pay\n${upi.name || business?.name || ''}\n${upi.vpa || ''}`,
          170, y + 20
        )
      }

      // ===== FOOTER =====
      doc.moveDown(4)
      doc.fontSize(9).fillColor('#666')
        .text("Goods once sold cannot be returned or exchanged.", { align:'center' })
        .text("Thank you for your purchase!", { align:'center' })

      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}
