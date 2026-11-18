export interface DemoDatasetStrings {
  faltantesCsv: string;
  detalhesValorJson: string;
  statusJson: string;
  detalhesNaJson: string;
}

export function getDemoDatasetStrings(): DemoDatasetStrings {
  const faltantesCsv = [
    'ID do pacote,N.º Rota,Data de Inbound,Localização do pacote',
    '4401928301.0,SP-Z1-04,2026-11-15 07:10:00,Na estação',
    '"4401928302,",SP-Z1-04,15/11/2026 08:25,Na estacao',
    '4401928303,SP-Z1-04,2026-11-15 09:40:00,NA ESTAÇÃO',
    '4401928304,SP-Z1-04,2026-11-15 11:15:00,Na estação',
    '4401928305,SP-Z1-04,2026-11-16 06:50:00,Na estação',
    '4401928306,SP-Z1-04,2026-11-16 08:05:00,Na estação',
    '4401928307,SP-Z1-04,2026-11-16 10:30:00,Na estação',
    '4401928308,SP-Z1-04,2026-11-16 14:20:00,Na estação',
    '4401928309,SP-Z1-04,2026-11-17 07:45:00,Na estação',
    '4401928310,SP-Z1-04,2026-11-17 09:15:00,Na estação',
    '4401928401,SP-Z2-11,2026-11-15 10:00:00,Na estação',
    '4401928402,SP-Z2-11,2026-11-16 09:10:00,Na estação',
    '4401928403,SP-Z2-11,2026-11-17 11:30:00,Na estação',
    '4401928404,SP-Z2-11,2026-11-16 12:00:00,Na estação',
    '4401928405,SP-Z2-11,2026-11-16 15:45:00,Na estação',
    '4401928501,SP-Z3-08,2026-11-15 06:30:00,Na estação',
    '4401928502,SP-Z3-08,2026-11-17 13:20:00,Na estação',
    '4401928503,SP-Z3-08,2026-11-17 16:00:00,Na estação',
    '4401928991,SP-Z1-04,,Na estação',
    '4401928992,SP-Z1-04,2026-11-16 10:00:00,Em trânsito',
    '4401928993,SP-Z2-11,2026-11-16 11:00:00,Entregue',
  ].join('\n');

  const detalhesValorJson = JSON.stringify(
    [
      { SHP_SHIPMENT_ID: 4401928301, SHP_ITEM_DESC: 'Fone Bluetooth TWS Pro', SHP_ORDER_COST: 189.9 },
      { SHP_SHIPMENT_ID: '4401928302', SHP_ITEM_DESC: 'Teclado Mecânico Compacto ABNT2', SHP_ORDER_COST: '349,50' },
      { SHP_SHIPMENT_ID: '4401928303', SHP_ITEM_DESC: 'Garrafa Térmica Inox 750ml', SHP_ORDER_COST: 78.0 },
      { SHP_SHIPMENT_ID: '4401928304', SHP_ITEM_DESC: 'Kit 3 Camisetas Básicas Algodão', SHP_ORDER_COST: 119.9 },
      { SHP_SHIPMENT_ID: '4401928305', SHP_ITEM_DESC: 'Mouse Sem Fio Ergonômico', SHP_ORDER_COST: 94.5 },
      { SHP_SHIPMENT_ID: '4401928306', SHP_ITEM_DESC: 'Carregador Turbo USB-C 65W', SHP_ORDER_COST: 135.0 },
      { SHP_SHIPMENT_ID: '4401928307', SHP_ITEM_DESC: 'Mochila Executiva Impermeável', SHP_ORDER_COST: 215.0 },
      { SHP_SHIPMENT_ID: '4401928309', SHP_ITEM_DESC: 'Câmera IP Wi-Fi 1080p', SHP_ORDER_COST: 164.0 },
      { SHP_SHIPMENT_ID: '4401928401', SHP_ITEM_DESC: 'Cafeteira Elétrica 15 Xícaras', SHP_ORDER_COST: 'R$ 199,90' },
      { SHP_SHIPMENT_ID: '4401928402', SHP_ITEM_DESC: 'Tênis Corrida Ultraleve 41', SHP_ORDER_COST: 289.0 },
      { SHP_SHIPMENT_ID: '4401928404', SHP_ITEM_DESC: 'Liquidificador 900W Copo Vidro', SHP_ORDER_COST: 229.0 },
      { SHP_SHIPMENT_ID: '4401928405', SHP_ITEM_DESC: 'Aspirador Portátil Recarregável', SHP_ORDER_COST: 179.5 },
      { SHP_SHIPMENT_ID: '4401928501', SHP_ITEM_DESC: 'Monitor LED 24" Full HD IPS', SHP_ORDER_COST: '799,00' },
      { SHP_SHIPMENT_ID: '4401928503', SHP_ITEM_DESC: 'Luminária Articulada Mesa LED', SHP_ORDER_COST: 89.9 },
    ],
    null,
    2
  );

  const statusJson = JSON.stringify(
    [
      { ID: '4401928301', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:00:00' },
      { ID: 4401928302, STATUS_SHP: 'sorting', SUB_STATUS: 'cart_pending', LAST_UPD: '2026-11-17 08:10:00' },
      { ID: '4401928303', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:12:00' },
      { ID: '4401928304', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:15:00' },
      { ID: '4401928305', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:18:00' },
      { ID: '4401928306', STATUS_SHP: 'sorting', SUB_STATUS: '', LAST_UPD: '2026-11-17 08:20:00' },
      { ID: '4401928307', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:25:00' },
      { ID: '4401928308', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:30:00' },
      { ID: '4401928309', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:35:00' },
      { ID: '4401928310', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:40:00' },
      { ID: '4401928401', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:42:00' },
      { ID: '4401928402', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:44:00' },
      { ID: '4401928403', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 08:46:00' },
      { ID: '4401928404', STATUS_SHP: 'in_station', SUB_STATUS: 'problem_solving', LAST_UPD: '2026-11-17 08:50:00' },
      { ID: '4401928405', STATUS_SHP: 'on_route', SUB_STATUS: 'in_cart', LAST_UPD: '2026-11-17 08:55:00' },
      { ID: '4401928501', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 09:00:00' },
      { ID: '4401928502', STATUS_SHP: 'in_station', SUB_STATUS: 'sorting', LAST_UPD: '2026-11-17 09:05:00' },
      { ID: '4401928503', STATUS_SHP: 'returned', SUB_STATUS: 'damaged', LAST_UPD: '2026-11-17 09:10:00' },
    ],
    null,
    2
  );

  const detalhesNaJson = JSON.stringify(
    [
      { ID: '4401928308', DESCRICAO: 'Suporte Articulado para Monitor', VALOR_REAL: 149.9 },
      { ID: '4401928502', DESCRICAO: 'SSD NVMe 1TB PCIe 4.0', VALOR_REAL: '429,00' },
    ],
    null,
    2
  );

  return {
    faltantesCsv,
    detalhesValorJson,
    statusJson,
    detalhesNaJson,
  };
}
