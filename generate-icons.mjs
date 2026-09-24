import sharp from 'sharp';

// Icone dell'app ricavate dal marchio "NS" del logo NSGroup (senza la scritta GROUP / SERVIZI ALLE IMPRESE)
const LOGO = './public/logo-nsgroup.jpeg';
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// area del marchio nel logo (1659x640) e zone da imbiancare dove entrano le lettere della scritta
const L = 60, T = 30, W = 840, H = 590;
const bianco = (x, y, w, h) => `<rect x="${x - L}" y="${y - T}" width="${w}" height="${h}" fill="#fff"/>`;
// sotto la curva del marchio: poligono che segue il bordo della curva e copre SERVIZI ALLE IMPRESE
const poligono = [[670, 540], [1000, 540], [1000, 700], [590, 700], [592, 604], [612, 590], [640, 572], [662, 554], [668, 545]]
  .map(([x, y]) => `${x - L},${y - T}`).join(' ');
const maschera = Buffer.from(`<svg width="${W}" height="${H}"><polygon points="${poligono}" fill="#fff"/>${bianco(872, 300, 100, 260)}</svg>`);

const marchio = await sharp(LOGO)
  .extract({ left: L, top: T, width: W, height: H })
  .composite([{ input: maschera }])
  .png()
  .toBuffer();

// quadrato bianco con margine, così l'icona non tocca i bordi
const LATO = 1024, INTERNO = 820;
const ridotto = await sharp(marchio).resize(INTERNO, INTERNO, { fit: 'contain', background: '#ffffff' }).toBuffer();
const quadrato = await sharp({ create: { width: LATO, height: LATO, channels: 3, background: '#ffffff' } })
  .composite([{ input: ridotto, gravity: 'center' }])
  .png()
  .toBuffer();

for (const size of sizes) {
  await sharp(quadrato).resize(size, size).png().toFile(`./public/icon-${size}x${size}.png`);
  console.log(`✓ icon-${size}x${size}.png`);
}
