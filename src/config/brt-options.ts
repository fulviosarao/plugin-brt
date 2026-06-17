export interface BrtPluginOptions {
    /**
     * userID fornito da BRT in fase di attivazione.
     * Corrisponde al campo "account.userID" nella BRT REST API.
     */
    userId: string;

    /**
     * Password fornita da BRT in fase di attivazione.
     * Corrisponde al campo "account.password" nella BRT REST API.
     */
    password: string;

    /**
     * Codice cliente mittente (campo BRT VABCCM), numero intero a 7 cifre.
     * Fornito da BRT. Es: 1234567
     */
    senderCustomerCode: number;

    /**
     * Linea di partenza (deposito BRT di competenza), numero intero.
     * Fornito da BRT. Es: 201 (Bologna), 080 (Milano), 310 (Roma).
     */
    departureDepot: number;

    /**
     * Tipo porto:
     *   'DAP' = porto franco (mittente paga la spedizione)
     *   'EXW' = porto assegnato (destinatario paga)
     * Default: 'DAP'
     */
    deliveryFreightTypeCode?: 'DAP' | 'EXW';

    /**
     * Formato etichetta di default proposto nel form di fulfillment.
     *   'PDF' = stampa normale (laser/inkjet), formato 105×74mm
     *   'ZPL' = stampante termica (Zebra, Dymo, ecc.)
     * Può essere sovrascritto ordine per ordine dall'operatore.
     * Default: 'PDF'
     */
    defaultLabelFormat?: 'PDF' | 'ZPL';

    /**
     * Configurazione auto-fulfillment BRT.
     * Se abilitato, la lettera di vettura viene creata automaticamente quando
     * un ordine raggiunge lo stato PaymentSettled.
     */
    autoFulfillment?: {
        /** Abilita la creazione automatica. Default: false */
        enabled: boolean;
        /** Peso di default in kg usato per tutti gli ordini automatici */
        weightKG: number;
        /** Numero di colli di default. Default: 1 */
        numberOfParcels?: number;
        /** Formato etichetta. Se omesso usa defaultLabelFormat */
        labelFormat?: 'PDF' | 'ZPL';
    };
}

export const BRT_PLUGIN_OPTIONS = Symbol('BRT_PLUGIN_OPTIONS');

export const BRT_SHIPMENT_URL = 'https://api.brt.it/rest/v1/shipments';
// L'endpoint tracking REST e' sotto /rest/v1/tracking (non /rest/tracking).
export const BRT_TRACKING_URL = 'https://api.brt.it/rest/v1/tracking';
