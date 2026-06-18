import React from 'react';
import { useQuery, useDetailComponentData, Card } from '@vendure/admin-ui/react';
import { gql } from 'graphql-tag';

const GET_BRT_LABELS = gql`
    query BrtOrderLabels($id: ID!) {
        order(id: $id) {
            id
            fulfillments {
                id
                method
                state
                customFields {
                    brtParcelId
                    brtLabelStream
                    brtLabelFormat
                }
            }
        }
    }
`;

interface BrtFulfillment {
    id: string;
    method: string;
    state: string;
    customFields?: {
        brtParcelId?: string | null;
        brtLabelStream?: string | null;
        brtLabelFormat?: string | null;
    } | null;
}

/**
 * Decodifica l'etichetta base64 restituita da BRT (PDF o ZPL) e ne forza il
 * download lato browser, senza passare da un endpoint dedicato.
 */
function downloadLabel(base64: string, format: string, parcelId: string) {
    const isZpl = (format || 'PDF').toUpperCase() === 'ZPL';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: isZpl ? 'text/plain' : 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etichetta-brt-${parcelId || 'spedizione'}.${isZpl ? 'zpl' : 'pdf'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

const btnStyle: React.CSSProperties = {
    padding: '6px 14px',
    background: '#cc0000',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
};

export function BrtLabelWidget() {
    const { entity } = useDetailComponentData<{ id: string }>();
    const orderId = entity?.id;

    if (!orderId) return null;

    // `useQuery` non è reattivo al cambio di variabili: si monta il figlio con
    // key=orderId così che, appena l'id dell'ordine è noto, la query parta una
    // sola volta su quel valore (re-mount al cambio ordine).
    return React.createElement(BrtLabelQuery, { key: orderId, orderId });
}

function BrtLabelQuery({ orderId }: { orderId: string }) {
    const { data, loading } = useQuery(GET_BRT_LABELS, { id: orderId });

    const fulfillments: BrtFulfillment[] = (data as any)?.order?.fulfillments ?? [];
    const brtFulfillments = fulfillments.filter(f => f.customFields?.brtParcelId);

    if (loading && !data) {
        return (
            <Card title="Etichetta BRT">
                <div style={{ fontSize: 13, color: '#6b7280' }}>Caricamento…</div>
            </Card>
        );
    }

    if (brtFulfillments.length === 0) {
        return (
            <Card title="Etichetta BRT">
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                    Nessuna spedizione BRT su questo ordine. L'etichetta compare qui dopo
                    la creazione della lettera di vettura (pagamento incassato).
                </div>
            </Card>
        );
    }

    return (
        <Card title="Etichetta BRT">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {brtFulfillments.map(f => {
                    const cf = f.customFields!;
                    const parcelId = cf.brtParcelId ?? '';
                    const format = (cf.brtLabelFormat || 'PDF').toUpperCase();
                    const stream = cf.brtLabelStream || '';
                    const hasLabel = stream.length > 10;
                    return (
                        <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 12, color: '#374151' }}>
                                Parcel ID: <strong>{parcelId}</strong>
                                <span style={{ color: '#9ca3af' }}> · {format} · {f.state}</span>
                            </div>
                            {hasLabel ? (
                                <button
                                    type="button"
                                    style={btnStyle}
                                    onClick={() => downloadLabel(stream, format, parcelId)}
                                >
                                    Scarica etichetta {format === 'ZPL' ? '(ZPL)' : '(PDF)'}
                                </button>
                            ) : (
                                <div style={{ fontSize: 12, color: '#dc2626' }}>
                                    Etichetta non disponibile per questa spedizione.
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
