import puppeteer from 'puppeteer'

function money(n) { return (Number(n || 0)).toFixed(2) }

function buildInvoiceHTML({ business, invoice, upi }) {
  const createdAt = new Date(invoice.createdAt || Date.now()).toLocaleString('en-IN')
  const styles = `
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 16px; background: #fff; color: #111; }
    .wrap { width: 794px; /* ~A4 width at 96dpi */ border: 1px solid #e5e7eb; padding: 16px; }
    .center { text-align: center; }
    .muted { color: #6b7280; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    h1 { margin: 0; font-size: 20px; }
    .sep { height: 1px; background: #e5e7eb; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 8px; border-bottom: 1px solid #f3f4f6; text-align: left; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    tfoot td { border-bottom: none; }
    .right { text-align: right; }
    .total { font-weight: 700; }
    .foot { margin-top: 24px; font-size: 11px; color: #6b7280; text-align: center; }
    .badge { display: inline-block; font-size: 11px; background: #eef2ff; color: #3730a3; padding: 2px 8px; border-radius: 999px; }
  </style>
  `

  const itemsRows = (invoice.items || []).map(it => `
    <tr>
      <td>${it.nameSnapshot || ''}</td>
      <td class="right">${it.qty}</td>
      <td class="right">₹ ${money(it.unitPrice)}</td>
      <td class="right">${it.taxPercent || 0}%</td>
      <td class="right">₹ ${money(it.lineTotal)}</td>
    </tr>
  `).join('')

  const upiBlock = (upi?.vpa) ? `
    <div class="muted" style="margin-top:6px">UPI: ${upi.vpa} (${upi.name || business?.name || ''})</div>
  ` : ''

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${styles}
</head>
<body>
  <div class="wrap">
    <div class="center">
      <h1>${business?.name || 'Shop'}</h1>
      ${business?.address ? `<div class="muted">${business.address}</div>` : ''}
      ${business?.phone ? `<div class="muted">Phone: ${business.phone}</div>` : ''}
      ${business?.gstin ? `<div class="muted">GSTIN: ${business.gstin}</div>` : ''}
    </div>

    <div class="sep"></div>

    <div class="row" style="font-size:12px">
      <div>
        <div><span class="muted">Invoice No:</span> <b>${invoice.number}</b></div>
        <div><span class="muted">Date:</span> ${createdAt}</div>
      </div>
      <div class="right">
        ${invoice.customerName ? `<div><span class="muted">Customer:</span> ${invoice.customerName}</div>` : ''}
        ${invoice.customerPhone ? `<div><span class="muted">Phone:</span> ${invoice.customerPhone}</div>` : ''}
        ${invoice.customerAddress ? `<div><span class="muted">Address:</span> ${invoice.customerAddress}</div>` : ''}
        ${invoice.customerCompany ? `<div class="badge">${invoice.customerCompany}</div>` : ''}
      </div>
    </div>

    <div style="margin-top:12px"></div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="right">Qty</th>
          <th class="right">Price</th>
          <th class="right">Tax %</th>
          <th class="right">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" class="right">Sub Total</td>
          <td class="right">₹ ${money(invoice.subTotal)}</td>
        </tr>
        <tr>
          <td colspan="4" class="right">Tax</td>
          <td class="right">₹ ${money(invoice.taxTotal)}</td>
        </tr>
        ${invoice.discount ? `
        <tr>
          <td colspan="4" class="right">Discount</td>
          <td class="right">-₹ ${money(invoice.discount)}</td>
        </tr>` : ''}
        ${invoice.rounding ? `
        <tr>
          <td colspan="4" class="right">Rounding</td>
          <td class="right">₹ ${money(invoice.rounding)}</td>
        </tr>` : ''}
        ${invoice.previousDue ? `
        <tr>
          <td colspan="4" class="right">Previous Due</td>
          <td class="right">₹ ${money(invoice.previousDue)}</td>
        </tr>` : ''}
        <tr>
          <td colspan="4" class="right total">TOTAL</td>
          <td class="right total">₹ ${money(invoice.total)}</td>
        </tr>
      </tfoot>
    </table>

    ${upiBlock}

    <div class="foot">
      <div>Goods once sold cannot be returned or exchanged.</div>
      <div>Thank you for your purchase!</div>
    </div>
  </div>
</body>
</html>
  `
}

export async function renderInvoicePNGBuffer({ business, invoice, upi }) {
  const html = buildInvoiceHTML({ business, invoice, upi })
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  try {
    const page = await browser.newPage()
    // Set viewport wide enough to fit the wrapper
    await page.setViewport({ width: 820, height: 1120, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const el = await page.$('.wrap')
    const buffer = await el.screenshot({ type: 'png' })
    return buffer
  } finally {
    await browser.close()
  }
}
