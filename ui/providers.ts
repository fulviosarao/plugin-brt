import { registerReactCustomDetailComponent } from '@vendure/admin-ui/react';
import { BrtLabelWidget } from './components/brt-label-widget.component';

export default [
    registerReactCustomDetailComponent({
        locationId: 'order-detail',
        component: BrtLabelWidget,
    }),
];
