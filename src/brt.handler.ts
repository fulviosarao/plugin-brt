import { FulfillmentHandler, Injector, LanguageCode, Logger } from '@vendure/core';
import { BrtService } from './brt.service';

const loggerCtx = 'BrtFulfillmentHandler';

let brtService: BrtService;

function truncate(value: string | undefined | null, max: number): string {
    return (value ?? '').slice(0, max);
}

export const brtFulfillmentHandler = new FulfillmentHandler({
    code: 'brt-fulfillment',
    description: [{ languageCode: LanguageCode.it, value: 'BRT Bartolini — Crea lettera di vettura automatica' }],

    args: {
        weightKG: {
            type: 'float',
            label: [{ languageCode: LanguageCode.it, value: 'Peso totale (kg)' }],
            required: true,
        },
        numberOfParcels: {
            type: 'int',
            label: [{ languageCode: LanguageCode.it, value: 'Numero colli' }],
            defaultValue: 1,
            required: true,
        },
        labelFormat: {
            type: 'string',
            label: [{ languageCode: LanguageCode.it, value: 'Formato etichetta' }],
            defaultValue: 'PDF',
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'PDF', label: [{ languageCode: LanguageCode.it, value: 'PDF (stampante normale)' }] },
                    { value: 'ZPL', label: [{ languageCode: LanguageCode.it, value: 'ZPL (stampante termica)' }] },
                ],
            },
        },
        notes: {
            type: 'string',
            label: [{ languageCode: LanguageCode.it, value: 'Note spedizione (opzionali)' }],
            required: false,
        },
    },

    init(injector: Injector) {
        brtService = injector.get(BrtService);
    },

    async createFulfillment(ctx, orders, lines, args) {
        const order = orders[0];
        if (!order) throw new Error('Nessun ordine trovato per il fulfillment');

        const addr = order.shippingAddress;
        if (!addr) throw new Error("Indirizzo di spedizione mancante sull'ordine");

        const consigneeName = truncate(addr.fullName || addr.company || 'Cliente', 70);
        const rawAddress = [addr.streetLine1, addr.streetLine2].filter(Boolean).join(', ');
        const consigneeAddress = truncate(rawAddress, 35);
        const consigneeZIP = truncate(addr.postalCode, 9);
        const consigneeCity = truncate(addr.city, 35);
        const consigneeProvince = truncate(addr.province, 2);
        const countryCode = (addr as any).countryCode ?? (addr as any).country?.code ?? 'IT';
        const consigneeCountry = truncate(countryCode, 2).toUpperCase();
        const labelFormat = (args.labelFormat as 'PDF' | 'ZPL') || brtService.defaultLabelFormat;

        // Riferimenti mittente: necessari sia in creazione sia in cancellazione.
        // Vanno memorizzati per poter cancellare la spedizione (delete li richiede).
        const numericSenderReference = Number(String(order.id).replace(/\D/g, '')) || undefined;
        const alphanumericSenderReference = truncate(order.code, 15);

        let result;
        try {
            result = await brtService.createShipment({
                // '1' (stringa) = etichetta richiesta. Con 'Y' BRT NON restituisce
                // il blocco labels e l'etichetta resta vuota.
                isLabelRequired: '1',
                labelParameters: {
                    outputType: labelFormat,
                    isBorderRequired: '1',
                    isLogoRequired: '1',
                },
                createData: {
                    departureDepot: brtService.departureDepot,
                    senderCustomerCode: brtService.senderCustomerCode,
                    deliveryFreightTypeCode: brtService.deliveryFreightTypeCode,
                    consigneeCompanyName: consigneeName,
                    consigneeAddress,
                    consigneeZIPCode: consigneeZIP,
                    consigneeCity,
                    consigneeProvinceAbbreviation: consigneeCountry === 'IT' ? consigneeProvince : undefined,
                    consigneeCountryAbbreviationISOAlpha2: consigneeCountry,
                    consigneeTelephone: truncate(addr.phoneNumber, 16) || undefined,
                    isAlertRequired: '0',
                    isCODMandatory: '0',
                    numberOfParcels: args.numberOfParcels ?? 1,
                    weightKG: args.weightKG,
                    // BRT richiede anche il riferimento NUMERICO (oltre all'alfanumerico
                    // = order.code), altrimenti createShipment fallisce con -68
                    // "numericSenderReference". Derivato dalle cifre dell'id ordine.
                    numericSenderReference,
                    alphanumericSenderReference,
                    notes: args.notes ? truncate(args.notes, 70) : undefined,
                },
            });
        } catch (err: any) {
            Logger.error(`Errore creazione spedizione BRT per ordine ${order.code}: ${err.message}`, loggerCtx);
            throw err;
        }

        // BRT serializza `label` come array, ma per spedizioni a collo singolo puo'
        // restituire un oggetto singolo: normalizziamo a array.
        const rawLabel = result.createResponse.labels?.label;
        const label = Array.isArray(rawLabel) ? rawLabel[0] : rawLabel;
        const parcelId = label?.parcelID ?? result.createResponse.parcelNumberFrom ?? '';
        const trackingCode = label?.trackingByParcelID ?? parcelId;
        const labelStream = label?.stream ?? '';

        if (!labelStream) {
            Logger.warn(
                `Spedizione BRT ${order.code} creata SENZA etichetta (labels assente nella response). ` +
                    `Verificare isLabelRequired='1' e l'abilitazione stampa etichetta sul codice cliente.`,
                loggerCtx,
            );
        }

        Logger.info(`Spedizione BRT ok — ordine ${order.code}, parcelID: ${parcelId}`, loggerCtx);

        return {
            method: 'BRT',
            trackingCode,
            customFields: {
                brtParcelId: parcelId,
                brtLabelStream: labelStream,
                brtLabelFormat: labelFormat,
                // serve per la cancellazione (delete richiede numericSenderReference)
                brtNumericReference: numericSenderReference != null ? String(numericSenderReference) : undefined,
                brtAlphaReference: alphanumericSenderReference,
            } as any,
        };
    },

    async onFulfillmentTransition(fromState, toState, { fulfillment }) {
        if (toState !== 'Cancelled') return;

        const parcelId = (fulfillment.customFields as any)?.brtParcelId;
        if (!parcelId) return;

        const cf = fulfillment.customFields as any;
        const numericRef = cf?.brtNumericReference ? Number(cf.brtNumericReference) : undefined;
        const alphaRef = cf?.brtAlphaReference || undefined;

        Logger.info(`Cancellazione spedizione BRT parcelID: ${parcelId}`, loggerCtx);
        try {
            await brtService.deleteShipment({
                deleteData: {
                    senderCustomerCode: brtService.senderCustomerCode,
                    // BRT identifica la spedizione da cancellare con numericSenderReference
                    // + alphanumericSenderReference (gli stessi usati in creazione).
                    numericSenderReference: numericRef,
                    alphanumericSenderReference: alphaRef,
                },
            });
        } catch (err: any) {
            Logger.warn(`Cancellazione BRT fallita per ${parcelId}: ${err.message}`, loggerCtx);
        }
    },
});
