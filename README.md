# @fulviosarao/plugin-brt

Plugin Vendure 3.6+ per l'integrazione con **BRT Bartolini** — crea lettere di vettura, genera etichette (PDF o ZPL) e gestisce il tracking delle spedizioni direttamente dall'Admin UI.

---

## Funzionalità

- **Creazione automatica spedizione BRT** quando l'admin crea un Fulfillment su un ordine
- **Lettera di vettura in PDF o ZPL** (base64) salvata nel Fulfillment, scaricabile via GraphQL
- **Tracking code** BRT (`parcelID`) memorizzato nel campo nativo `Fulfillment.trackingCode`
- **Cancellazione automatica** su BRT quando un Fulfillment viene annullato
- **API tracking** disponibile via `BrtService.trackParcel(parcelId)`
- **Nessuna dipendenza esterna** oltre a `@vendure/core` — usa `fetch` nativo (Node.js 18+)

---

## Prerequisiti

- Vendure `^3.6.1`
- Node.js `>=18` (usa `fetch` nativo)
- **Account BRT attivo** con il servizio REST API abilitato (concordare con BRT l'attivazione)
  - BRT fornirà: `userID`, `password`, `senderCustomerCode`, `departureDepot`
  - È necessario scegliere la modalità operativa: **AutoConferma** (consigliata) o Conferma Esplicita

---

## Installazione

### 1. Autenticazione a GitHub Packages

Il pacchetto è pubblicato sul registry privato GitHub Packages. Configurare `~/.npmrc`:

```bash
echo "@fulviosarao:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=TOKEN_GITHUB" >> ~/.npmrc
```

Oppure creare un file `.npmrc` nella root del progetto backend:

```
@fulviosarao:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

> Il `GITHUB_TOKEN` deve avere scope `read:packages`.

### 2. Installazione del pacchetto

```bash
npm install @fulviosarao/plugin-brt
```

### 3. Migrazione database

Aggiungere le colonne personalizzate alla tabella `fulfillment`. Creare il file:

```
src/migrations/TIMESTAMP-add-brt-fulfillment-fields.ts
```

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBrtFulfillmentFields1776100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "fulfillment" ADD COLUMN IF NOT EXISTS "customFieldsBrtparcelid" character varying(255)`,
        );
        await queryRunner.query(
            `ALTER TABLE "fulfillment" ADD COLUMN IF NOT EXISTS "customFieldsBrtlabelstream" text`,
        );
        await queryRunner.query(
            `ALTER TABLE "fulfillment" ADD COLUMN IF NOT EXISTS "customFieldsBrtlabelformat" character varying(10)`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "fulfillment" DROP COLUMN IF EXISTS "customFieldsBrtlabelformat"`,
        );
        await queryRunner.query(
            `ALTER TABLE "fulfillment" DROP COLUMN IF EXISTS "customFieldsBrtlabelstream"`,
        );
        await queryRunner.query(
            `ALTER TABLE "fulfillment" DROP COLUMN IF EXISTS "customFieldsBrtparcelid"`,
        );
    }
}
```

> **Convenzione colonne Vendure**: il nome della colonna è `customFields` + nome del campo tutto minuscolo. Es: `brtParcelId` → `customFieldsBrtparcelid`.

Eseguire la migrazione:

```bash
# Se si usa il runner TypeORM integrato in Vendure (index.js -- migrate):
node dist/index.js -- migrate

# Oppure manualmente con psql:
docker exec -it shopstack-postgres psql -U postgres -d thekbeauty \
  -c "ALTER TABLE fulfillment ADD COLUMN IF NOT EXISTS \"customFieldsBrtparcelid\" varchar(255)"
docker exec -it shopstack-postgres psql -U postgres -d thekbeauty \
  -c "ALTER TABLE fulfillment ADD COLUMN IF NOT EXISTS \"customFieldsBrtlabelstream\" text"
docker exec -it shopstack-postgres psql -U postgres -d thekbeauty \
  -c "ALTER TABLE fulfillment ADD COLUMN IF NOT EXISTS \"customFieldsBrtlabelformat\" varchar(10)"
```

### 4. Configurazione in `vendure-config.ts`

Aggiungere il plugin all'array `plugins`:

```typescript
import { BrtPlugin } from '@fulviosarao/plugin-brt';

export const config: VendureConfig = {
    // ...
    plugins: [
        // ... altri plugin ...
        BrtPlugin.init({
            userId: process.env.BRT_USER_ID!,
            password: process.env.BRT_PASSWORD!,
            senderCustomerCode: parseInt(process.env.BRT_SENDER_CUSTOMER_CODE!),
            departureDepot: parseInt(process.env.BRT_DEPARTURE_DEPOT!),
            deliveryFreightTypeCode: 'DAP',   // 'DAP' = porto franco | 'EXW' = porto assegnato
            defaultLabelFormat: 'PDF',         // 'PDF' | 'ZPL'
        }),
    ],
};
```

> **ATTENZIONE**: Il plugin aggiunge automaticamente i custom fields su `Fulfillment` tramite la callback `configuration`. Non è necessario dichiararli manualmente in `vendure-config.customFields.Fulfillment`, ma se già presenti (da una versione precedente dell'integrazione) rimuoverli per evitare duplicati.

### 5. Variabili d'ambiente

Aggiungere al file `ecosystem.config.js` (o al proprio sistema di gestione env):

```javascript
env: {
    // ... altre variabili ...
    BRT_USER_ID: "XXXXXX",                  // userID fornito da BRT
    BRT_PASSWORD: "******",                  // password fornita da BRT
    BRT_SENDER_CUSTOMER_CODE: "1234567",     // codice cliente mittente (7 cifre)
    BRT_DEPARTURE_DEPOT: "201",              // linea di partenza (es. 201 = Bologna)
    // Opzionali (default già impostati nel plugin):
    // BRT_DELIVERY_FREIGHT_TYPE: "DAP",     // 'DAP' o 'EXW' — sovrascrivibile via init()
    // BRT_LABEL_FORMAT: "PDF",              // 'PDF' o 'ZPL' — sovrascrivibile via init()
}
```

### 6. Riavvio e Admin UI

```bash
# Compilare il backend
npm run build

# Riavviare con le nuove env vars
pm2 restart thekbeauty-vendure --update-env

# La Admin UI si ricompila automaticamente al prossimo avvio.
# Se non compare il nuovo handler, forzare la ricompilazione:
rm -rf admin-ui/dist
node compile-admin-ui.js
pm2 restart thekbeauty-vendure
```

---

## Utilizzo nell'Admin UI

1. Aprire un ordine in stato **PaymentSettled**
2. Cliccare **"Create Fulfillment"**
3. Selezionare l'handler **"BRT Bartolini — Crea lettera di vettura automatica"**
4. Compilare il form:
   - **Peso totale (kg)** — obbligatorio, es. `1.5`
   - **Numero colli** — default `1`
   - **Formato etichetta** — `PDF` (stampante normale) o `ZPL` (termica)
   - **Note spedizione** — facoltative, max 70 caratteri
5. Cliccare **Confirm** → la spedizione viene creata su BRT in tempo reale
6. L'ordine transita automaticamente allo stato **Shipped**
7. Il `trackingCode` del Fulfillment contiene il codice di tracking BRT (`trackingByParcelID`)

---

## Recuperare l'etichetta (lettera di vettura)

L'etichetta è salvata come base64 nel custom field `brtLabelStream` del Fulfillment.

### Via Admin GraphQL

```graphql
query GetFulfillment($id: ID!) {
    order(id: $id) {
        fulfillments {
            id
            state
            method
            trackingCode
            customFields {
                brtParcelId
                brtLabelFormat
                brtLabelStream   # base64 (PDF o ZPL)
            }
        }
    }
}
```

### Decodifica ed apertura del PDF (JavaScript)

```javascript
// brtLabelStream è la stringa base64 ricevuta da GraphQL
function openBrtLabel(base64, format) {
    if (format === 'PDF') {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
    } else {
        // ZPL: inviare direttamente alla stampante termica
        console.log('ZPL:', atob(base64));
    }
}
```

### Via Logistics API (se configurata)

Se si utilizza `scripts/logistics-api.js`, i dati BRT sono già esposti nella risposta:

```json
{
    "fulfillments": [
        {
            "state": "Shipped",
            "method": "BRT",
            "trackingCode": "102165010070284",
            "brtParcelId": "102165010070284108",
            "brtLabelFormat": "PDF"
        }
    ]
}
```

> Il campo `brtLabelStream` (base64) **non** viene esposto dalla Logistics API per mantenere
> le risposte leggere. Scaricarlo direttamente via Admin GraphQL quando necessario.

---

## Struttura campi BRT nel Fulfillment

| Campo custom          | Colonna DB                      | Contenuto                                  |
|-----------------------|----------------------------------|--------------------------------------------|
| `brtParcelId`         | `customFieldsBrtparcelid`        | Barcode BRT (18 char, es. `102165010070284108`) |
| `brtLabelStream`      | `customFieldsBrtlabelstream`     | Etichetta in base64 (PDF o ZPL, max ~26KB) |
| `brtLabelFormat`      | `customFieldsBrtlabelformat`     | `'PDF'` oppure `'ZPL'`                     |

Campi nativi Vendure usati:

| Campo nativo            | Contenuto                                          |
|-------------------------|----------------------------------------------------|
| `trackingCode`          | `trackingByParcelID` BRT (15 char, per tracking web) |
| `method`                | Sempre `'BRT'`                                     |
| `handlerCode`           | Sempre `'brt-fulfillment'`                         |

---

## Tracking spedizioni

BRT mette a disposizione un portale tracking pubblico. Usando il `trackingCode` (campo `trackingByParcelID`):

```
https://vas.brt.it/vas/sped_det_show.hsm?referer=sped_numspe_par.hsm&Nspedizioni={trackingCode}
```

Per tracking programmatico via API BRT (richiede credenziali):

```typescript
import { BrtService } from '@fulviosarao/plugin-brt';

// Il BrtService è iniettabile in qualsiasi provider NestJS dopo l'installazione del plugin
@Injectable()
class MyService {
    constructor(private brtService: BrtService) {}

    async getTracking(parcelId: string) {
        return this.brtService.trackParcel(parcelId);
    }
}
```

---

## Gestione errori BRT

Il plugin lancia eccezioni con messaggi leggibili in caso di errori API BRT.
I codici di errore principali:

| Codice | Descrizione                                    | Soluzione                                  |
|--------|------------------------------------------------|--------------------------------------------|
| `-5`   | Parametro non valido                           | Verificare i dati dell'indirizzo           |
| `-7`   | Login fallito                                  | Controllare `userId` e `password`          |
| `-57`  | Parametro login mancante                       | Verificare `senderCustomerCode`            |
| `-63`  | Errore calcolo instradamento (CAP non trovato) | Verificare CAP e città del destinatario    |
| `-64`  | Errore numerazione pacco                       | Contattare BRT (range segnacolli esaurito) |
| `-67`  | Codice cliente non collegato all'utente        | Verificare `senderCustomerCode` con BRT    |
| `-68`  | Dato errato o inconsistente                    | Leggere il campo `message` per dettagli   |

In caso di errore, la creazione del Fulfillment viene **annullata** (Vendure restituisce `CreateFulfillmentError`) e l'ordine rimane in stato `PaymentSettled`. L'operatore può correggere i dati e riprovare.

---

## Cancellazione spedizione

Quando un Fulfillment viene portato allo stato **Cancelled** nell'Admin UI, il plugin chiama automaticamente `PUT /delete` sull'API BRT per cancellare la spedizione.

> La cancellazione è possibile solo finché BRT non ha preso in gestione la spedizione (cioè prima del ritiro fisico). Dopo il ritiro, BRT restituisce il codice `-152` e la cancellazione fallisce silenziosamente (viene loggato un warning ma non viene lanciata un'eccezione).

---

## Compatibilità

| Plugin version | Vendure version |
|----------------|-----------------|
| `1.0.x`        | `^3.6.1`        |

---

## Migrazione da plugin interno (src/plugins/brt/)

Se si stava usando la versione interna del plugin (non npm), seguire questi passi:

1. Installare il pacchetto npm (passi 1–2 sopra)
2. Aggiornare `vendure-config.ts`:
   - Rimuovere: `import { BrtPlugin } from './plugins/brt/brt.plugin';`
   - Aggiungere: `import { BrtPlugin } from '@fulviosarao/plugin-brt';`
   - Cambiare `BrtPlugin` (senza `init()`) in `BrtPlugin.init({ ... })` con le credenziali
   - Rimuovere i custom fields `Fulfillment` dichiarati manualmente (ora li gestisce il plugin)
3. Eliminare la cartella `src/plugins/brt/`
4. Ricompilare e riavviare

La migrazione DB **non è necessaria** — le colonne esistenti sono compatibili.

---

## Licenza

MIT
