export interface BrtAccount {
    userID: string;
    password: string;
}

export interface BrtLabelParameters {
    outputType: 'PDF' | 'ZPL';
    isBorderRequired?: 'Y' | 'N';
    isLogoRequired?: 'Y' | 'N';
    isBarcodeControlRowRequired?: 'Y' | 'N';
    labelFormat?: string;
}

export interface BrtCreateData {
    network?: string;
    departureDepot: number;
    senderCustomerCode: number;
    deliveryFreightTypeCode: 'DAP' | 'EXW';
    consigneeCompanyName: string;
    consigneeAddress: string;
    consigneeZIPCode: string;
    consigneeCity: string;
    consigneeProvinceAbbreviation?: string;
    consigneeCountryAbbreviationISOAlpha2: string;
    consigneeContactName?: string;
    consigneeTelephone?: string;
    consigneeEMail?: string;
    consigneeMobilePhoneNumber?: string;
    isAlertRequired?: '0' | '1';
    /**
     * '0' = spedizione NON in contrassegno. Va dichiarato esplicitamente: il codice
     * cliente puo' essere condiviso con utenti che usano il contrassegno, e in tal
     * caso BRT rifiuta la createShipment con -68 "IsCODMandatory" se il flag manca.
     */
    isCODMandatory?: '0' | '1';
    serviceType?: string;
    numberOfParcels: number;
    weightKG: number;
    numericSenderReference?: number;
    alphanumericSenderReference?: string;
    notes?: string;
    parcelsHandlingCode?: string;
    deliveryType?: string;
}

export interface BrtCreateRequest {
    account: BrtAccount;
    createData: BrtCreateData;
    isLabelRequired: 'Y' | 'N';
    labelParameters: BrtLabelParameters;
}

export interface BrtLabel {
    dataLength: number;
    parcelID: string;
    trackingByParcelID: string;
    parcelNumberGeoPost?: string;
    /** Etichetta in base64 (PDF o ZPL) */
    stream: string;
    streamDigitalLabel?: string;
}

export interface BrtExecutionMessage {
    code: number;
    severity: string;
    codeDesc: string;
    message: string;
}

export interface BrtCreateResponse {
    currentTimeUTC: string;
    executionMessage: BrtExecutionMessage;
    arrivalTerminal?: string;
    arrivalDepot?: string;
    deliveryZone?: string;
    parcelNumberFrom?: string;
    parcelNumberTo?: string;
    departureDepot?: number;
    seriesNumber?: number;
    consigneeCompanyName?: string;
    consigneeAddress?: string;
    consigneeZIPCode?: string;
    consigneeCity?: string;
    labels?: {
        label_LENGTH: number;
        label: BrtLabel[];
    };
}

export interface BrtCreateResult {
    createResponse: BrtCreateResponse;
}

export interface BrtDeleteRequest {
    account: BrtAccount;
    deleteData: {
        senderCustomerCode: number;
        numericSenderReference?: number;
        alphanumericSenderReference?: string;
    };
}
