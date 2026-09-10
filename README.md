# Canvas-arkisto

Hae **kaikki oma datasi** mistä tahansa Canvas LMS -ympäristöstä ja rakenna siitä
yhdellä komennolla itsenäinen, kaunis **paikallinen websivu**, jonka voit avata
ilman internetiä.

- 🔒 **Vain luku.** Työkalu ei koskaan kirjoita Canvasiin — se lähettää vain
  `GET`-kutsuja, ja kirjoitus on estetty koodissa. Henkilökohtainen access token on
  täysi käyttöoikeus nimissäsi, joten esto on tärkeä: väärä kirjoitus (esim.
  ennenaikainen palautus) näkyisi opettajalle eikä sitä voi perua.
- 📦 **Nolla riippuvuutta.** Pelkkä Node.js (18+). Ei `npm install`ia, ei ulkoisia
  kirjastoja.
- 🌐 **Yleiskäyttöinen.** Toimii minkä tahansa oppilaitoksen Canvasilla
  (`*.instructure.com`, oppilaitoksen oma osoite, itse asennettu…). Toimii sekä opiskelijan
  että opettajan tunnuksella — se, mihin sinulla ei ole pääsyä, ohitetaan hiljaa.
- 🗂 **Hakee kaiken:** kurssit, tehtävät ja omat palautukset/arvosanat, moduulit,
  sivujen koko sisältö, tiedotteet, keskustelut ja niiden viestit, kalenterin,
  tentit, tiedostot, opettajat, kurssikuvaukset, Inbox-viestit ja profiilin.

> ⚠️ Tämä on epävirallinen työkalu, ei Instructuren tuote. Käytä omalla vastuulla ja
> oman oppilaitoksesi käyttöehtojen mukaisesti.

---

## Pikaohje (3 askelta)

```bash
# 1. Kloonaa
git clone https://github.com/OWNER/Canvas.git   # vaihda OWNER repon omistajaan
cd Canvas

# 2. Kerro Canvas-osoitteesi ja tokenisi
cp .env.example .env          # Windows PowerShell: copy .env.example .env
#   → avaa .env ja täytä CANVAS_BASE_URL ja CANVAS_TOKEN

# 3. Hae data ja rakenna sivu
node run.mjs
```

Tämän jälkeen avaa selaimessa **`out/index.html`** (tuplaklikkaus riittää).

---

## Asennus

### 1. Node.js

Tarvitset **Node.js 18 tai uudemman** (natiivi `fetch` vaatii sen). Tarkista:

```bash
node --version
```

Jos komentoa ei löydy, asenna Node: <https://nodejs.org/> (LTS-versio riittää).
Muuta ei tarvita — ei `npm install`ia, koska projektissa ei ole riippuvuuksia.

### 2. Kloonaa repo

```bash
git clone https://github.com/OWNER/Canvas.git   # vaihda OWNER repon omistajaan
cd Canvas
```

### 3. Luo Canvasin käyttöoikeustunnus (access token)

1. Kirjaudu oman oppilaitoksesi Canvasiin selaimella.
2. Mene: **Tili → Asetukset** (englanniksi *Account → Settings*).
3. Vieritä kohtaan **Käyttöoikeustunnukset** (*Approved Integrations*).
4. Paina **+ Uusi käyttöoikeustunnus** (*+ New Access Token*), anna sille nimi
   (esim. "canvas-arkisto") ja halutessasi vanhenemispäivä.
5. Kopioi näytetty token **heti** — sitä ei näytetä enää myöhemmin.

> 💡 Token kiertää yleensä oppilaitoksen SAML/MFA-kirjautumisen: rajapinta hyväksyy
> tokenin suoraan eikä kysy monivaihetunnistusta. Kohtele tokenia kuin salasanaa.

### 4. Aseta osoite ja token

Kopioi mallitiedosto ja täytä arvot:

```bash
cp .env.example .env
```

Avaa `.env` ja täytä:

```ini
CANVAS_BASE_URL=https://oppilaitos.instructure.com
CANVAS_TOKEN=1234~AbCdEfGhIjKlMnOpQrStUvWxYz0123456789
```

- **CANVAS_BASE_URL** = Canvasin verkko-osoite **ilman** `/api/v1`-osaa.
  Sama kuin selaimen osoiterivillä kun olet Canvasissa (esim.
  `https://koulu.instructure.com`).
- **CANVAS_TOKEN** = äsken luomasi token.

`.env` on `.gitignore`ssa, joten se **ei koskaan** päädy versionhallintaan.
Vaihtoehtoisesti voit antaa arvot ympäristömuuttujina ilman `.env`-tiedostoa:

```bash
# macOS / Linux
CANVAS_BASE_URL=https://... CANVAS_TOKEN=... node run.mjs

# Windows PowerShell
$env:CANVAS_BASE_URL="https://..."; $env:CANVAS_TOKEN="..."; node run.mjs
```

---

## Käyttö

### Kaikki kerralla

```bash
node run.mjs
```

Tämä hakee datan ja rakentaa sivun. Lopputulos: **`out/index.html`**.

### Vaiheet erikseen

```bash
node collect.mjs      # hae kaikki -> out/data.json (+ out/raw/*.json)
node build.mjs        # out/data.json -> out/index.html
```

Erottelu on hyödyllinen, koska haku voi kestää muutaman minuutin (isolla
kurssimäärällä satoja API-kutsuja). Kun data on kerran haettu, voit rakentaa sivun
uudelleen sekunnissa ilman uutta hakua.

### Nopea, suppea haku

```bash
node collect.mjs --shallow
```

`--shallow` ohittaa raskaimmat osat (sivujen koko sisältö, keskustelujen viestit,
tiedostolistat). Hyvä nopeaan yleiskuvaan tai jos haluat säästää kutsuja.

### npm-skriptit (vaihtoehtoisesti)

```bash
npm start             # = node run.mjs
npm run collect
npm run collect:shallow
npm run build
```

---

## Mitä sivulla näkyy

`out/index.html` on **yksi itsenäinen tiedosto** (data upotettu sisään), joten se
avautuu ilman palvelinta ja ilman verkkoyhteyttä. Sisältö:

| Näkymä | Sisältö |
|---|---|
| **Yleiskatsaus** | Tunnusluvut (kurssit, tehtävät, myöhässä, arvioidut) + seuraavat määräpäivät |
| **Tulossa** | Kaikki tehtävät, joilla on tuleva määräpäivä, aikajärjestyksessä |
| **Tiedotteet** | Kaikkien kurssien tiedotteet koko sisältöineen |
| **Viestit** | Canvasin Inbox-keskustelut viesteineen |
| **Tiedostot** | Oman käyttäjäkansion tiedostot |
| **Kurssit** (per kurssi) | Tehtävät + tila/arvosana, kurssikuvaus, moduulit, sivujen sisältö, keskustelut viesteineen, kurssin tiedostot, tentit, opettajat |

- Vasemman reunan hakukenttä suodattaa kurssit.
- Teema seuraa käyttöjärjestelmää (vaalea/tumma).
- Tehtävän tila päätellään palautuksesta ja määräpäivästä: **Arvioitu**,
  **Palautettu**, **Avoin**, **Myöhässä**, **Ei palautusta**.

---

## Tietoturva ja yksityisyys

- 🔑 **Token pysyy koneellasi.** Sitä käytetään vain suorissa kutsuissa Canvasiin
  (`Authorization: Bearer …`). Sitä ei kirjoiteta mihinkään tulostiedostoon eikä
  lähetetä minnekään muualle.
- 🗃 **Haettu data on henkilökohtaista.** `out/` (ja `raw/`) sisältää omat
  arvosanasi, viestisi ym. Molemmat ovat `.gitignore`ssa. **Älä** jaa `out/`-kansiota
  tai `index.html`-tiedostoa kenellekään, jonka et halua näkevän dataasi — sivuun on
  upotettu kaikki haettu sisältö.
- 🚫 **Ei kirjoituksia Canvasiin.** Kaikki liikenne kulkee yhden portin
  (`lib/canvas.mjs`) läpi, joka hyväksyy vain `GET`/`HEAD`. Muut metodit heitetään
  virheeksi ennen kuin yhtään kutsua lähtee.
- 🎯 **Token vain omaan oppilaitokseen.** Työkalu lähettää `Authorization`-otsakkeen
  vain siihen origin-osoitteeseen, jonka annoit `CANVAS_BASE_URL`:ssa. Canvasin
  palauttamaa toisen hostin osoitetta (esim. haitallista sivutuslinkkiä) ei seurata,
  joten tokenia ei voi napata ohjaamalla pyyntö muualle.
- 🧽 **Kyvykkyys-salaisuudet siivotaan.** Canvasin vastaukset sisältävät
  kirjautumattomia access-URLeja (tiedostojen `?verifier=…`, kalenterin `.ics`-syöte).
  Ne poistetaan haetusta datasta, jottei jaettu sivu paljasta niitä. Omaan käyttöösi
  linkit toimivat silti, kun olet kirjautunut Canvasiin.
- 🛡 **Sivu on lukittu.** Rakennettu `index.html` sisältää tiukan
  Content-Security-Policyn (vain oma nonce-skripti saa ajautua, ei verkkokutsuja,
  kuvat vain oppilaitoksen osoitteesta) ja saniteetin, joka poistaa Canvasin
  HTML-sisällöstä skriptit ja tapahtumankäsittelijät. Näin toisen käyttäjän sisältöön
  ujuttama koodi ei aja mitään, kun avaat arkiston.

---

## Projektin rakenne

```
Canvas/
├── run.mjs             # kerää + rakenna yhdellä komennolla
├── collect.mjs         # hakee kaiken -> out/data.json (+ out/raw/)
├── build.mjs           # out/data.json -> out/index.html
├── lib/
│   ├── canvas.mjs      # API-asiakas: sivutus, tahdinsäätö, vain GET/HEAD
│   ├── config.mjs      # lukee .env / ympäristömuuttujat
│   └── template.html   # sivupohja (CSS + selainlogiikka)
├── .env.example        # malli asetuksista (kopioi -> .env)
├── .gitignore          # .env ja out/ eivät päädy versionhallintaan
├── package.json
└── README.md
```

---

## Vianetsintä

| Oire | Syy / korjaus |
|---|---|
| `Missing configuration` | `.env` puuttuu tai `CANVAS_BASE_URL`/`CANVAS_TOKEN` tyhjä. |
| Kaikki kutsut → `401` | Token väärin, vanhentunut tai kuuluu toiseen Canvas-osoitteeseen. |
| `403 · rate-limited` lokissa | Canvasin tahdinsäätö; työkalu odottaa itse ja jatkaa. Aja uudelleen jos keskeytyi. |
| Sivut/keskustelut puuttuvat | Ajoit `--shallow`. Aja ilman sitä. |
| Jokin osa näkyy `notes`-lokissa `status: 404` | Sinulla ei ole pääsyä siihen (piilotettu välilehti tms.). Tämä on normaalia ja ohitetaan. |
| Kuvat eivät lataudu sivulla | Canvasin kuvat vaativat kirjautumisen; offline-arkistossa ne eivät näy. Linkit toimivat kun olet kirjautunut Canvasiin. |

Haun tarkka loki: `out/raw/_log.json` (kutsujen määrä ja mahdolliset virheet).

---

## Lisenssi

MIT — ks. [LICENSE](LICENSE).
