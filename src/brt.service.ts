import { Inject, Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { BRT_PLUGIN_OPTIONS, BRT_SHIPMENT_URL, BRT_TRACKING_URL, BrtPluginOptions } from './config/brt-options';
import { BrtCreateRequest, BrtCreateResult, BrtDeleteRequest } from './types/brt-api.types';

const loggerCtx = 'BrtService';

@Injectable()
export class BrtService {
    constructor(
        @Inject(BRT_PLUGIN_OPTIONS) private options: BrtPluginOptions,
    ) {}

    get deliveryFreightTypeCode(): 'DAP' | 'EXW' {
        return this.options.deliveryFreightTypeCode ?? 'DAP';
    }

    get defaultLabelFormat(): 'PDF' | 'ZPL' {
        return this.options.defaultLabelFormat ?? 'PDF';
    }

    get senderCustomerCode(): number {
        return this.options.senderCustomerCode;
    }

    get departureDepot(): number {
        return this.options.departureDepot;
    }

    async createShipment(request: Omit<BrtCreateRequest, 'account'>): Promise<BrtCreateResult> {
        const payload: BrtCreateRequest = {
            ...request,
            account: { userID: this.options.userId, password: this.options.password },
        };

        Logger.info(
            `Creazione spedizione BRT per ${request.createData.consigneeCompanyName} (${request.createData.consigneeCity})`,
            loggerCtx,
        );

        const res = await fetch(`${BRT_SHIPMENT_URL}/shipment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`BRT API HTTP ${res.status}: ${body}`);
        }

        const result = await res.json() as BrtCreateResult;
        const execMsg = result?.createResponse?.executionMessage;

        if (execMsg && execMsg.code < 0) {
            throw new Error(`BRT errore ${execMsg.code} (${execMsg.codeDesc}): ${execMsg.message}`);
        }
        if (execMsg && execMsg.code > 0) {
            Logger.warn(`BRT warning ${execMsg.code}: ${execMsg.message}`, loggerCtx);
        }

        const parcelId = result.createResponse.labels?.label?.[0]?.parcelID;
        Logger.info(`Spedizione BRT creata — parcelID: ${parcelId}`, loggerCtx);

        return result;
    }

    async deleteShipment(request: Omit<BrtDeleteRequest, 'account'>): Promise<void> {
        const payload: BrtDeleteRequest = {
            ...request,
            account: { userID: this.options.userId, password: this.options.password },
        };

        const res = await fetch(`${BRT_SHIPMENT_URL}/delete`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`BRT DELETE HTTP ${res.status}: ${body}`);
        }

        const result = await res.json() as { deleteResponse?: { executionMessage?: { code: number; message: string } } };
        const execMsg = result?.deleteResponse?.executionMessage;
        if (execMsg && execMsg.code < 0) {
            throw new Error(`BRT cancellazione errore ${execMsg.code}: ${execMsg.message}`);
        }

        Logger.info('Spedizione BRT cancellata', loggerCtx);
    }

    async trackParcel(parcelID: string): Promise<unknown> {
        const res = await fetch(`${BRT_TRACKING_URL}/parcelID/${encodeURIComponent(parcelID)}`, {
            headers: {
                userID: this.options.userId,
                password: this.options.password,
            },
        });

        if (!res.ok) {
            throw new Error(`BRT tracking HTTP ${res.status}`);
        }

        return res.json();
    }
}
