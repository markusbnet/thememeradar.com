/**
 * NYSE/NASDAQ Ticker Whitelist
 * Used to validate extracted tickers against known listed securities.
 * Includes: S&P 500, NASDAQ-100, popular meme stocks, major ETFs, and other commonly traded tickers.
 */

const VALID_TICKERS: string[] = [
  // S&P 500 / Mega Caps
  'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'GOOG', 'META', 'BRK', 'BRKB', 'BRKA',
  'TSLA', 'UNH', 'XOM', 'JNJ', 'JPM', 'V', 'PG', 'MA', 'HD', 'CVX',
  'LLY', 'MRK', 'ABBV', 'PEP', 'AVGO', 'KO', 'COST', 'TMO', 'MCD', 'WMT',
  'CSCO', 'ACN', 'ABT', 'BAC', 'CRM', 'PFE', 'CMCSA', 'LIN', 'DHR', 'NKE',
  'AMD', 'TXN', 'ORCL', 'NFLX', 'PM', 'NEE', 'RTX', 'UNP', 'UPS', 'INTC',
  'BMY', 'COP', 'LOW', 'HON', 'AMGN', 'QCOM', 'INTU', 'ELV', 'SPGI', 'ISRG',
  'IBM', 'GE', 'CAT', 'BA', 'NOW', 'MDT', 'GS', 'AMAT', 'DE', 'BLK',
  'GILD', 'ADP', 'SYK', 'MDLZ', 'VRTX', 'ADI', 'BKNG', 'TMUS', 'TJX', 'REGN',
  'PYPL', 'MMC', 'LRCX', 'CB', 'SCHW', 'PGR', 'CI', 'ZTS', 'SNPS', 'SO',
  'DUK', 'MO', 'FI', 'AON', 'EOG', 'BSX', 'CDNS', 'KLAC', 'ITW', 'SHW',
  'CME', 'NOC', 'ICE', 'BDX', 'HCA', 'CSX', 'GD', 'FDX', 'WM', 'PLD',
  'MCK', 'CL', 'EQIX', 'MPC', 'PSX', 'VLO', 'EMR', 'MAR', 'HUM', 'PXD',
  'MCO', 'APD', 'NSC', 'MSI', 'AJG', 'ORLY', 'SLB', 'GM', 'DXCM', 'PSA',
  'OXY', 'PCAR', 'AZO', 'EW', 'CCI', 'TGT', 'ADM', 'ADSK', 'MMM', 'NXPI',
  'F', 'SRE', 'AEP', 'TFC', 'CARR', 'JCI', 'SPG', 'MET', 'D', 'PH',
  'AFL', 'TRV', 'MNST', 'AIG', 'PAYX', 'STZ', 'TEL', 'O', 'WELL', 'DLR',
  'HLT', 'DOW', 'MSCI', 'ROP', 'ALL', 'CTSH', 'DVN', 'NEM', 'WBA', 'HSY',
  'A', 'KMB', 'IQV', 'BIIB', 'CMG', 'RSG', 'YUM', 'EA', 'FAST', 'IDXX',
  'VRSK', 'GIS', 'CSGP', 'ROST', 'HAL', 'DD', 'WEC', 'KR', 'CTAS', 'EXC',
  'DLTR', 'KHC', 'KEYS', 'OTIS', 'XEL', 'ED', 'GEHC', 'EFX', 'IT', 'ODFL',
  'VMC', 'MLM', 'ANSS', 'GPN', 'AWK', 'IR', 'MCHP', 'PPG', 'FANG', 'APTV',
  'FTV', 'HPQ', 'TSCO', 'RMD', 'CPRT', 'URI', 'FITB', 'SBAC', 'MPWR', 'CAH',
  'CDW', 'ACGL', 'DOV', 'MTD', 'EPAM', 'DAL', 'WTW', 'EQR', 'WAT', 'WAB',
  'LH', 'AMP', 'CBOE', 'TROW', 'CHD', 'GLW', 'SWKS', 'HIG', 'CINF', 'FE',
  'IFF', 'DTE', 'AVB', 'ES', 'STE', 'HPE', 'LUV', 'STT', 'MTB', 'ULTA',
  'ZBRA', 'CLX', 'BR', 'ETR', 'BAX', 'VTR', 'MKC', 'HOLX', 'NTRS', 'MAA',
  'CF', 'RCL', 'BALL', 'PKI', 'ARE', 'VICI', 'DGX', 'PTC', 'TDY', 'LYB',
  'K', 'COO', 'SNA', 'CNP', 'J', 'INVH', 'IRM', 'TRGP', 'ALGN', 'WRB',
  'AMCR', 'IP', 'SWK', 'TER', 'CE', 'EXPD', 'AES', 'LDOS', 'KEY', 'BF',
  'CMS', 'DRI', 'NTAP', 'MOS', 'LKQ', 'BRO', 'GPC', 'EXR', 'AVY', 'WST',
  'JBHT', 'FLT', 'TXT', 'WRK', 'CCL', 'MGM', 'BG', 'NDSN', 'PEAK', 'TAP',
  'HAS', 'WY', 'EMN', 'NVR', 'TTWO', 'CPT', 'LNT', 'ATO', 'REG', 'L',
  'TPR', 'IPG', 'POOL', 'PAYC', 'UDR', 'KIM', 'NI', 'HST', 'JKHY', 'CPB',
  'SJM', 'AAL', 'UAL', 'PNR', 'BXP', 'GL', 'NRG', 'FMC', 'ALLE', 'RL',
  'CHRW', 'BBWI', 'CTLT', 'AAP', 'BWA', 'AIZ', 'IEX', 'SEE', 'HSIC',
  'TECH', 'RHI', 'CRL', 'MTCH', 'GNRC', 'AOS', 'FOXA', 'FOX', 'LUMN',
  'ZION', 'WYNN', 'NCLH', 'CZR', 'PNW', 'BEN', 'PARA', 'VFC', 'WHR',
  'DXC', 'MHK', 'DISH',

  // NASDAQ-100 additions (not already listed)
  'ABNB', 'AEP', 'ATVI', 'CHTR', 'CSGP', 'CRWD', 'CTSH', 'DDOG', 'DLTR',
  'ENPH', 'FSLR', 'FTNT', 'GFS', 'ILMN', 'KDP', 'LCID', 'LULU', 'MRVL',
  'MELI', 'MRNA', 'OKTA', 'PANW', 'RIVN', 'SGEN', 'SIRI', 'TEAM',
  'VRSK', 'ZM', 'ZS',

  // Popular Meme Stocks / Reddit Favorites
  'GME', 'AMC', 'BB', 'BBBY', 'PLTR', 'SOFI', 'WISH', 'CLOV', 'SPCE',
  'MVIS', 'TLRY', 'SNDL', 'RKT', 'UWMC', 'RIDE', 'WKHS', 'GOEV',
  'CLNE', 'SENS', 'MNMD', 'MAPS', 'ASTS', 'DNA', 'BARK', 'OPEN',
  'SKLZ', 'DKNG', 'FUBO', 'LAZR', 'BYND', 'COIN', 'HOOD', 'UPST',
  'AFRM', 'RBLX', 'SNAP', 'PINS', 'ROKU', 'SQ', 'SHOP', 'SNOW',
  'NET', 'DOCN', 'PATH', 'U', 'UNITY', 'IONQ', 'RGTI', 'QUBT',
  'SMCI', 'MSTR', 'BITF', 'MARA', 'RIOT', 'HUT', 'CLSK', 'CIFR',
  'ARM', 'GRAB', 'SE', 'BABA', 'JD', 'PDD', 'NIO', 'XPEV', 'LI',
  'BIDU', 'BILI', 'TME', 'VNET', 'WB', 'DIDI', 'TAL', 'EDU',
  'IQ', 'YMM', 'TUYA', 'MNSO',

  // Popular ETFs
  'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'VEA', 'VWO', 'EFA', 'EEM',
  'AGG', 'BND', 'LQD', 'HYG', 'TLT', 'IEF', 'SHY', 'TIP', 'GOVT',
  'GLD', 'SLV', 'IAU', 'GDX', 'GDXJ', 'USO', 'UNG', 'DBA', 'DBC',
  'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLP', 'XLY', 'XLB', 'XLU', 'XLRE',
  'VNQ', 'VNQI', 'SCHD', 'VIG', 'DVY', 'HDV', 'NOBL', 'VYM',
  'ARKK', 'ARKW', 'ARKG', 'ARKF', 'ARKQ', 'ARKX',
  'SOXL', 'SOXS', 'TQQQ', 'SQQQ', 'SPXS', 'SPXL', 'UDOW', 'SDOW',
  'UVXY', 'SVXY', 'VXX', 'VIXY',
  'IBIT', 'GBTC', 'ETHE', 'BITO',
  'SOXX', 'SMH', 'XBI', 'IBB', 'KWEB', 'MCHI',
  'RSP', 'MDY', 'IJR', 'IWO', 'IWN', 'VBR', 'VBK',

  // Major Financials
  'WFC', 'MS', 'C', 'USB', 'PNC', 'AXP', 'ALLY', 'COF', 'DFS',
  'SYF', 'CFG', 'HBAN', 'RF', 'CMA',

  // Major Tech / Cloud / Software
  'PLTR', 'CRWD', 'DDOG', 'MDB', 'SNOW', 'NET', 'ZS', 'OKTA',
  'TWLO', 'ESTC', 'CFLT', 'GTLB', 'HCP', 'TTD', 'BILL',
  'DOCU', 'FIVN', 'HUBS', 'WDAY', 'VEEV', 'COUP', 'PCOR',
  'APP', 'DASH', 'UBER', 'LYFT', 'ABNB',

  // Biotech / Pharma
  'MRNA', 'BNTX', 'AZN', 'GSK', 'NVS', 'SNY', 'BMY', 'TAK',
  'VRTX', 'REGN', 'SGEN', 'EXEL', 'SRPT', 'ALNY', 'INCY',
  'JAZZ', 'NBIX', 'BMRN', 'RARE', 'PTCT', 'PRTA', 'HALO',

  // Semiconductors
  'INTC', 'AMD', 'NVDA', 'AVGO', 'QCOM', 'TXN', 'MU', 'MRVL',
  'ADI', 'LRCX', 'AMAT', 'KLAC', 'NXPI', 'MCHP', 'ON', 'SWKS',
  'QRVO', 'MPWR', 'WOLF', 'GFS', 'TSM', 'ASML', 'UMC',

  // Energy
  'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'PXD', 'OXY', 'MPC', 'PSX', 'VLO',
  'DVN', 'FANG', 'HAL', 'HES', 'BKR', 'MRO', 'APA', 'CTRA',
  'OVV', 'SM', 'RRC', 'EQT', 'AR', 'CHK', 'TELL',

  // Cannabis
  'TLRY', 'CGC', 'ACB', 'SNDL', 'CRON', 'OGI', 'VFF', 'GRWG',

  // EV / Automotive
  'TSLA', 'F', 'GM', 'RIVN', 'LCID', 'NIO', 'XPEV', 'LI',
  'GOEV', 'FSR', 'RIDE', 'WKHS', 'MULN', 'NKLA', 'QS', 'CHPT',
  'PLUG', 'FCEL', 'BE', 'BLNK', 'EVGO',

  // Retail / Consumer
  'WMT', 'COST', 'TGT', 'HD', 'LOW', 'DG', 'DLTR', 'ROST', 'TJX',
  'BBY', 'LULU', 'GPS', 'ANF', 'AEO', 'URBN', 'FIVE', 'OLLI',
  'BURL', 'KSS', 'M', 'JWN', 'VSCO',

  // Real Estate / REITs
  'PLD', 'AMT', 'CCI', 'EQIX', 'PSA', 'DLR', 'SPG', 'O', 'WELL',
  'AVB', 'EQR', 'VTR', 'BXP', 'ARE', 'SLG', 'VNO', 'KIM', 'HST',
  'MPW', 'OHI', 'NNN',

  // Media / Entertainment / Social
  'DIS', 'NFLX', 'CMCSA', 'WBD', 'PARA', 'LYV', 'IMAX',
  'RBLX', 'EA', 'TTWO', 'ATVI', 'ZNGA', 'DKNG',
  'SPOT', 'SNAP', 'PINS', 'TWTR', 'MTCH', 'BMBL',

  // Space / Defense / Aerospace
  'BA', 'LMT', 'NOC', 'GD', 'RTX', 'HII', 'LHX', 'TDG',
  'SPCE', 'ASTS', 'RDW', 'MNTS', 'ASTR',
  'KTOS', 'RKLB',

  // Telecom
  'T', 'VZ', 'TMUS',

  // Airlines / Travel / Cruise
  'AAL', 'UAL', 'DAL', 'LUV', 'JBLU', 'SAVE', 'ALK', 'HA',
  'CCL', 'RCL', 'NCLH',
  'BKNG', 'EXPE', 'ABNB', 'TRIP', 'MMYT',

  // Food / Beverage
  'KO', 'PEP', 'MCD', 'SBUX', 'CMG', 'DPZ', 'QSR', 'WEN', 'JACK',
  'YUM', 'DNUT', 'BROS',

  // Healthcare / Medical
  'UNH', 'JNJ', 'PFE', 'ABT', 'TMO', 'DHR', 'ISRG', 'BSX', 'SYK',
  'MDT', 'EW', 'HCA', 'ZBH', 'BAX', 'BDX', 'RMD', 'HOLX',
  'DXCM', 'ALGN', 'PODD', 'IRTC', 'TNDM', 'SWAV',

  // Insurance
  'BRK', 'AIG', 'MET', 'PRU', 'ALL', 'TRV', 'AFL', 'PGR',
  'HIG', 'CINF', 'CB', 'MMC', 'AON', 'WRB', 'GL',

  // Payments / Fintech
  'V', 'MA', 'PYPL', 'SQ', 'AFRM', 'SOFI', 'UPST', 'HOOD',
  'COIN', 'BILL', 'GPN', 'FIS', 'FISV', 'WU', 'FOUR',

  // Additional commonly traded stocks
  'CLF', 'X', 'NUE', 'STLD', 'AA', 'FCX', 'VALE',
  'GOLD', 'NEM', 'FNV', 'WPM', 'AEM', 'KGC', 'AG',
  'LEVI', 'HBI', 'PVH', 'CPRI', 'RL',
  'KMI', 'WMB', 'OKE', 'ET', 'EPD', 'PAA', 'MPLX',
  'BTU', 'ARCH', 'AMR', 'HCC',
  'MOS', 'NTR', 'IPI', 'CF',
  'CROX', 'SKX', 'FL', 'BIRD', 'ONON',
  'ABNB', 'EXPE', 'BKNG', 'MAR', 'HLT', 'H', 'IHG', 'WH',
  'SIG', 'TIFF',
  'CELH', 'MNST', 'KDP', 'SAM', 'STZ',
  'CAR', 'HTZ',
  'CHWY', 'W', 'ETSY',
  'ZG', 'RDFN', 'OPEN',
  'PTON', 'LMND', 'ROOT',
  'COUR', 'DUOL', 'CHGG',
  'FVRR', 'UPWK',
  'CRSP', 'EDIT', 'NTLA', 'BEAM',
  'AI', 'BBAI', 'SOUN', 'PRCT',
  'LUNR', 'JOBY', 'ACHR', 'LILM',
  'VRT', 'GEV', 'VST', 'CEG', 'TLN',
  'OKLO', 'SMR', 'NNE', 'LEU', 'UEC', 'CCJ', 'DNN',
  'DELL', 'HPQ', 'HPE', 'LNVGY',
  'WOLF', 'CREE',
  'PANW', 'FTNT', 'ZS', 'CRWD', 'S', 'CYBR',
];

export const TICKER_WHITELIST = new Set(VALID_TICKERS);
