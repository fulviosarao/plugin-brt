import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { BRT_PLUGIN_OPTIONS, BrtPluginOptions } from './config/brt-options';
import { brtFulfillmentHandler } from './brt.handler';
import { BrtService } from './brt.service';

/**
 * BrtPlugin — integrazione corriere BRT Bartolini per Vendure 3.6+.
 *
 * Registra il FulfillmentHandler BRT che, al momento della creazione del fulfillment
 * da parte dell'admin, chiama l'API REST BRT per generare la spedizione e l'etichetta.
 *
 * Custom fields aggiunti automaticamente su `Fulfillment`:
 *   - brtParcelId      — barcode BRT (18 char), usato per tracking
 *   - brtLabelStream   — etichetta in base64 (PDF o ZPL, max 26.000 char)
 *   - brtLabelFormat   — 'PDF' | 'ZPL'
 *
 * Vedi README.md per la guida completa all'installazione e alla migrazione DB.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        BrtService,
        {
            provide: BRT_PLUGIN_OPTIONS,
            useFactory: () => BrtPlugin.options,
        },
    ],
    configuration: config => {
        const existing = config.shippingOptions?.fulfillmentHandlers ?? [];
        config.shippingOptions = {
            ...config.shippingOptions,
            fulfillmentHandlers: [brtFulfillmentHandler, ...existing],
        } as any;

        if (!config.customFields) (config as any).customFields = {};
        const fulfillmentFields = (config.customFields as any)?.Fulfillment ?? [];
        (config.customFields as any).Fulfillment = [
            ...fulfillmentFields,
            {
                name: 'brtParcelId',
                type: 'string',
                nullable: true,
                label: [{ languageCode: 'it' as any, value: 'BRT — Parcel ID (barcode)' }],
            },
            {
                name: 'brtLabelStream',
                type: 'text',
                nullable: true,
                label: [{ languageCode: 'it' as any, value: 'BRT — Etichetta base64' }],
            },
            {
                name: 'brtLabelFormat',
                type: 'string',
                nullable: true,
                label: [{ languageCode: 'it' as any, value: 'BRT — Formato etichetta' }],
            },
        ];

        return config;
    },
    compatibility: '^3.6.1',
})
export class BrtPlugin {
    static options: BrtPluginOptions;

    static handler = brtFulfillmentHandler;

    /**
     * Inizializza il plugin con le credenziali BRT.
     *
     * @example
     * ```ts
     * BrtPlugin.init({
     *   userId: process.env.BRT_USER_ID!,
     *   password: process.env.BRT_PASSWORD!,
     *   senderCustomerCode: parseInt(process.env.BRT_SENDER_CUSTOMER_CODE!),
     *   departureDepot: parseInt(process.env.BRT_DEPARTURE_DEPOT!),
     *   deliveryFreightTypeCode: 'DAP',
     *   defaultLabelFormat: 'PDF',
     * })
     * ```
     */
    static init(options: BrtPluginOptions): typeof BrtPlugin {
        BrtPlugin.options = options;
        return BrtPlugin;
    }
}
