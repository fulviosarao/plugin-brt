import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
    EventBus,
    Logger,
    OrderService,
    OrderStateTransitionEvent,
    RequestContext,
} from '@vendure/core';
import { BRT_PLUGIN_OPTIONS, BrtPluginOptions } from './config/brt-options';

const loggerCtx = 'BrtAutoFulfillmentService';

@Injectable()
export class BrtAutoFulfillmentService implements OnModuleInit {
    constructor(
        @Inject(BRT_PLUGIN_OPTIONS) private options: BrtPluginOptions,
        private eventBus: EventBus,
        private orderService: OrderService,
    ) {}

    onModuleInit() {
        if (!this.options.autoFulfillment?.enabled) return;

        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async event => {
            if (event.toState !== 'PaymentSettled') return;
            await this.createAutoFulfillment(event.ctx, event.order.id as string);
        });

        Logger.info('Auto-fulfillment BRT attivo — lettera di vettura creata al PaymentSettled', loggerCtx);
    }

    private async createAutoFulfillment(ctx: RequestContext, orderId: string): Promise<void> {
        const cfg = this.options.autoFulfillment!;

        const order = await this.orderService.findOne(ctx, orderId, ['lines']);
        if (!order) {
            Logger.warn(`Auto-fulfillment BRT: ordine ${orderId} non trovato`, loggerCtx);
            return;
        }

        // Evita doppio fulfillment se già creato manualmente
        const existing = await this.orderService.getOrderFulfillments(ctx, order);
        if (existing.length > 0) {
            Logger.info(
                `Auto-fulfillment BRT: ordine ${order.code} ha già ${existing.length} fulfillment(s), skip`,
                loggerCtx,
            );
            return;
        }

        if (!order.lines?.length) {
            Logger.warn(`Auto-fulfillment BRT: ordine ${order.code} senza righe, skip`, loggerCtx);
            return;
        }

        const labelFormat = cfg.labelFormat ?? this.options.defaultLabelFormat ?? 'PDF';
        const numberOfParcels = cfg.numberOfParcels ?? 1;

        try {
            const result = await this.orderService.createFulfillment(ctx, {
                handler: {
                    code: 'brt-fulfillment',
                    arguments: [
                        { name: 'weightKG', value: String(cfg.weightKG) },
                        { name: 'numberOfParcels', value: String(numberOfParcels) },
                        { name: 'labelFormat', value: labelFormat },
                        { name: 'notes', value: '' },
                    ],
                },
                lines: order.lines.map(l => ({ orderLineId: l.id, quantity: l.quantity })),
            });

            if ('id' in result) {
                Logger.info(
                    `Auto-fulfillment BRT creato per ordine ${order.code} — tracking: ${result.trackingCode}`,
                    loggerCtx,
                );
            } else {
                Logger.error(
                    `Auto-fulfillment BRT fallito per ordine ${order.code}: ${JSON.stringify(result)}`,
                    loggerCtx,
                );
            }
        } catch (err: any) {
            Logger.error(`Auto-fulfillment BRT errore per ordine ${order.code}: ${err.message}`, loggerCtx);
        }
    }
}
