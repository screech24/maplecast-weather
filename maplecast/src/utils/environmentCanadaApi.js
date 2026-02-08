/**
 * Environment Canada Weather Alerts System
 * Using CAP (Common Alerting Protocol) format - updated for 2025+
 */

import axios from 'axios';
import xml2js from 'xml2js';

/**
 * Get the base URL for EC API requests
 * Development: use local proxy
 * Production: use Cloudflare Worker
 */
const EC_API_BASE_URL = process.env.NODE_ENV === 'development'
  ? '/proxy-api'
  : 'https://maplecast-ec-proxy.jfabbro24.workers.dev';

// EC Color codes
export const EC_ALERT_COLORS = {
  RED: { bg: '#DC3545', text: '#FFFFFF', border: '#B02A37' },
  YELLOW: { bg: '#FFC107', text: '#000000', border: '#D39E00' },
  GREY: { bg: '#6C757D', text: '#FFFFFF', border: '#565E64' },
  ORANGE: { bg: '#FD7E14', text: '#FFFFFF', border: '#DC6A12' }
};

/**
 * Get responsible office for a province
 */
function getResponsibleOfficeForProvince(provinceCode) {
  const officeMap = {
    'bc': 'CWVR',  // Pacific and Yukon Storm Prediction Centre
    'ab': 'CWWG',  // Prairie and Arctic Storm Prediction Centre (CWEG redirects here)
    'sk': 'CWWG',  // Prairie and Arctic Storm Prediction Centre
    'mb': 'CWWG',  // Prairie and Arctic Storm Prediction Centre
    'on': 'CWTO',  // Ontario Storm Prediction Centre
    'qc': 'CWUL',  // Quebec Storm Prediction Centre
    'nb': 'CWHX',  // Atlantic Storm Prediction Centre
    'ns': 'CWHX',  // Atlantic Storm Prediction Centre
    'pe': 'CWHX',  // Atlantic Storm Prediction Centre
    'nl': 'CWHX',  // Atlantic Storm Prediction Centre (uses Atlantic)
    'yt': 'CWVR',  // Pacific and Yukon Storm Prediction Centre
    'nt': 'CWWG',  // Prairie and Arctic Storm Prediction Centre
    'nu': 'CWWG'   // Prairie and Arctic Storm Prediction Centre
  };
  return officeMap[provinceCode.toLowerCase()] || null;
}

/**
 * Get all active EC alert offices to check
 */
/**
 * Parse CAP XML to extract alert information
 * Returns both alerts and metadata about cancellations/updates
 */
async function parseCapXML(capXml) {
  try {
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(capXml);
    const alert = result.alert;

    if (!alert) {
      return { alerts: [], cancellations: [], msgType: null };
    }

    const msgType = alert.msgType?.[0] || 'Alert';
    const alertId = alert.identifier?.[0];
    const sentTime = alert.sent?.[0];

    // Parse references (format: "sender,identifier,sent" - comma separated, space between multiple refs)
    const references = [];
    if (alert.references && alert.references[0]) {
      const refString = alert.references[0];
      const refParts = refString.split(/\s+/);
      for (const ref of refParts) {
        const [, refId] = ref.split(',');
        if (refId) {
          references.push(refId);
        }
      }
    }

    // Handle Cancel messages - return list of cancelled alert IDs
    if (msgType === 'Cancel') {
      console.log(`🚫 CAP Cancel message: cancelling ${references.length} referenced alerts`);
      return { alerts: [], cancellations: references, msgType: 'Cancel' };
    }

    // Handle case where there's no info (shouldn't happen for Alert/Update)
    if (!alert.info) {
      return { alerts: [], cancellations: [], msgType };
    }

    const alerts = [];
    const infos = Array.isArray(alert.info) ? alert.info : [alert.info];

    for (const info of infos) {
      // Skip French alerts
      if (info.language && info.language[0] === 'fr-CA') {
        continue;
      }

      // Skip "AllClear" alerts (ended alerts)
      if (info.responseType && info.responseType[0] === 'AllClear') {
        console.log(`✅ AllClear response - alert has ended`);
        // Treat AllClear as a cancellation of referenced alerts
        return { alerts: [], cancellations: references.length > 0 ? references : [alertId], msgType: 'AllClear' };
      }

      // Skip expired alerts
      if (info.expires && new Date(info.expires[0]) < new Date()) {
        continue;
      }

      // Extract alert details from parameters
      const parameters = info.parameter || [];
      const alertType = parameters.find(p => p.valueName && p.valueName[0].includes('Alert_Type'))?.value?.[0] || 'statement';
      const alertName = parameters.find(p => p.valueName && p.valueName[0].includes('Alert_Name'))?.value?.[0] || 'Unknown Alert';
      const alertCoverage = parameters.find(p => p.valueName && p.valueName[0].includes('Alert_Coverage'))?.value?.[0] || 'Unknown Area';

      // Map CAP alert types to EC color system
      const { color, severity, type } = mapCapAlertToECCap(alertType, alertName);

      // Extract areas
      const areas = info.area || [];
      const areaDescriptions = areas.map(area => area.areaDesc?.[0]).filter(Boolean);

      // Parse the description to extract structured sections
      const parsedDescription = parseAlertDescription(info.description?.[0] || '');

      // Build the areas string for fallbacks
      const areasString = areaDescriptions.join(', ') || alertCoverage;

      alerts.push({
        id: alertId || `cap_${Date.now()}`,
        title: alertName,
        description: info.description?.[0] || '',
        instruction: info.instruction?.[0] || '',
        headline: info.headline?.[0] || alertName,
        details: {
          issuedTime: info.effective?.[0] || sentTime,
          impactLevel: severity,
          forecastConfidence: info.certainty?.[0] || 'Observed',
          summary: parsedDescription.summary || info.headline?.[0] || '',
          what: parsedDescription.what || alertName,
          when: parsedDescription.when || '',
          where: parsedDescription.where || areasString,
          remarks: parsedDescription.remarks || '',
          additionalInfo: parsedDescription.additionalInfo || '',
          inEffectFor: parsedDescription.inEffectFor || areasString
        },
        detailsUrl: info.web?.[0] || 'https://weather.gc.ca/',
        sent: sentTime,
        expires: info.expires?.[0],
        severity,
        alertType: type,
        ecColor: color,
        colors: EC_ALERT_COLORS[color],
        provider: 'Environment Canada',
        urgency: info.urgency?.[0],
        certainty: info.certainty?.[0],
        event: info.event?.[0],
        areas: areaDescriptions,
        coverage: alertCoverage,
        msgType: msgType,
        supersedes: references // IDs of alerts this one supersedes (for Update messages)
      });
    }

    return { alerts, cancellations: [], msgType };
  } catch (error) {
    console.error('Error parsing CAP XML:', error);
    return { alerts: [], cancellations: [], msgType: null };
  }
}

/**
 * Parse EC alert description to extract structured sections
 * EC descriptions contain What:/When:/Where: sections and other content
 * Format can be "What: content" or "What:\ncontent" on separate lines
 */
function parseAlertDescription(description) {
  if (!description) {
    return { summary: '', what: '', when: '', where: '', remarks: '', inEffectFor: '' };
  }

  const result = {
    summary: '',
    what: '',
    when: '',
    where: '',
    remarks: '',
    additionalInfo: '',
    inEffectFor: ''
  };

  // Split description into lines and clean up
  const lines = description.split(/\n/).map(line => line.trim()).filter(line => line);

  let summaryLines = [];
  let whatLines = [];
  let whenLines = [];
  let whereLines = [];
  let remarksLines = [];
  // Track current section: 'summary', 'what', 'when', 'where', 'remarks'
  let currentSection = 'summary';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Skip boilerplate footer text
    if (lowerLine.startsWith('please continue to monitor') ||
        lowerLine.startsWith('for more information') ||
        lowerLine.includes('colour-coded weather alerts') ||
        lowerLine.includes('color-coded weather alerts') ||
        lowerLine.startsWith('to report severe weather') ||
        lowerLine.includes('@ec.gc.ca') ||
        lowerLine.includes('#onstorm') ||
        lowerLine === '###') {
      continue;
    }

    // Check for section headers - "What:" or "What: content"
    if (lowerLine === 'what:' || lowerLine.startsWith('what:')) {
      currentSection = 'what';
      const content = line.substring(5).trim();
      if (content) {
        whatLines.push(content);
      }
    } else if (lowerLine === 'when:' || lowerLine.startsWith('when:')) {
      currentSection = 'when';
      const content = line.substring(5).trim();
      if (content) {
        whenLines.push(content);
      }
    } else if (lowerLine === 'where:' || lowerLine.startsWith('where:')) {
      currentSection = 'where';
      const content = line.substring(6).trim();
      if (content) {
        whereLines.push(content);
      }
    } else if (lowerLine.startsWith('remarks:') || lowerLine === 'remarks:') {
      currentSection = 'remarks';
      const content = line.substring(8).trim();
      if (content) {
        remarksLines.push(content);
      }
    } else if (lowerLine.startsWith('in effect for:')) {
      result.inEffectFor = line.substring(14).trim();
      currentSection = 'remarks';
    } else {
      // Content line - append to current section
      if (currentSection === 'summary') {
        summaryLines.push(line);
      } else if (currentSection === 'what') {
        whatLines.push(line);
      } else if (currentSection === 'when') {
        whenLines.push(line);
      } else if (currentSection === 'where') {
        whereLines.push(line);
      } else {
        remarksLines.push(line);
      }
    }
  }

  // Build final result - join multi-line content with newlines
  result.summary = summaryLines.join('\n');
  result.what = whatLines.join('\n');
  result.when = whenLines.join('\n');
  result.where = whereLines.join('\n');
  result.remarks = remarksLines.join('\n');

  return result;
}

/**
 * Map CAP alert types to EC color system
 * EC includes the color code in the alert name (e.g., "yellow warning - rainfall")
 */
function mapCapAlertToECCap(alertType, alertName) {
  const type = alertType.toLowerCase();
  const name = alertName.toLowerCase();

  // First, check if EC color is explicitly in the alert name
  // EC format: "yellow warning - rainfall", "red warning - tornado", etc.
  if (name.startsWith('red ') || name.includes(' red ')) {
    return { color: 'RED', severity: 'Severe', type: 'WARNING' };
  }
  if (name.startsWith('yellow ') || name.includes(' yellow ')) {
    if (name.includes('advisory')) {
      return { color: 'YELLOW', severity: 'Moderate', type: 'ADVISORY' };
    }
    if (name.includes('watch')) {
      return { color: 'YELLOW', severity: 'Moderate', type: 'WATCH' };
    }
    return { color: 'YELLOW', severity: 'Moderate', type: 'WARNING' };
  }
  if (name.startsWith('orange ') || name.includes(' orange ')) {
    return { color: 'ORANGE', severity: 'Moderate', type: 'ADVISORY' };
  }
  if (name.startsWith('grey ') || name.startsWith('gray ') || name.includes(' grey ') || name.includes(' gray ')) {
    return { color: 'GREY', severity: 'Minor', type: 'STATEMENT' };
  }

  // Fallback: determine color by alert type if not explicitly stated
  // RED = tornado, severe thunderstorm, blizzard, ice storm
  if (name.includes('tornado') || name.includes('severe thunderstorm') ||
      name.includes('blizzard') || name.includes('ice storm') || name.includes('hurricane')) {
    return { color: 'RED', severity: 'Severe', type: 'WARNING' };
  }

  // Check for warning types (default to yellow for regular warnings)
  if (type.includes('warning') || name.includes('warning') || name.includes('avertissement')) {
    return { color: 'YELLOW', severity: 'Moderate', type: 'WARNING' };
  }

  // Check for watch types
  if (type.includes('watch') || name.includes('watch') || name.includes('vigilance')) {
    return { color: 'YELLOW', severity: 'Moderate', type: 'WATCH' };
  }

  // Check for advisory types
  if (type.includes('advisory') || name.includes('advisory') || name.includes('avis')) {
    return { color: 'ORANGE', severity: 'Moderate', type: 'ADVISORY' };
  }

  // Check for special weather statements
  if (type.includes('statement') || name.includes('special weather statement') ||
      name.includes('bulletin météorologique spécial')) {
    return { color: 'GREY', severity: 'Minor', type: 'STATEMENT' };
  }

  // Default to grey for unknown types
  return { color: 'GREY', severity: 'Minor', type: 'STATEMENT' };
}

/**
 * Fetch CAP alerts for a specific date and office
 * Uses proxy to avoid CORS issues with Environment Canada servers
 * Structure: /today/alerts/cap/{date}/{office}/{hour}/*.cap
 */
async function fetchCapAlertsForDate(date, office) {
  try {
    // Use proxy endpoint to avoid CORS - proxy rewrites to dd.weather.gc.ca
    const url = `${EC_API_BASE_URL}/cap-dirs/${date}/${office}/`;
    console.log(`🔍 Fetching CAP directory via proxy: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    });

    // Parse the HTML directory listing to find hour subdirectories (00, 01, ..., 23)
    const html = response.data;
    const hourMatches = html.match(/<a[^>]+href="(\d{2})\/"/g) || [];

    const hourDirs = hourMatches.map(match => {
      const hourMatch = match.match(/href="(\d{2})\/"/);
      return hourMatch ? hourMatch[1] : null;
    }).filter(Boolean);

    console.log(`📁 Found ${hourDirs.length} hour directories for ${office} on ${date}`);

    const allAlerts = [];
    const cancelledIds = new Set();
    const supersededIds = new Set();

    // Fetch CAP files from recent hour directories (check more hours for updates/cancellations)
    const recentHours = hourDirs.slice(-6); // Check last 6 hours for better coverage
    for (const hour of recentHours) {
      try {
        const hourUrl = `${EC_API_BASE_URL}/cap-dirs/${date}/${office}/${hour}/`;
        console.log(`📂 Checking hour directory: ${hour}`);

        const hourResponse = await axios.get(hourUrl, {
          headers: { 'Accept': 'text/html,*/*' },
          timeout: 8000
        });

        // Parse to find .cap files in this hour directory
        const hourHtml = hourResponse.data;
        const fileMatches = hourHtml.match(/<a[^>]+href="([^"]+\.cap)"/g) || [];

        const capFiles = fileMatches.map(match => {
          const fileMatch = match.match(/href="([^"]+\.cap)"/);
          return fileMatch ? fileMatch[1] : null;
        }).filter(Boolean);

        console.log(`📄 Found ${capFiles.length} CAP files in hour ${hour}`);

        // Fetch ALL CAP files to ensure we catch updates and cancellations
        for (const capFile of capFiles) {
          try {
            const capUrl = `${EC_API_BASE_URL}/cap-file/${date}/${office}/${hour}/${capFile}`;

            const capResponse = await axios.get(capUrl, {
              headers: { 'Accept': 'application/xml,text/xml,*/*' },
              timeout: 8000
            });

            const capResult = await parseCapXML(capResponse.data);

            // Track cancelled alert IDs
            if (capResult.cancellations && capResult.cancellations.length > 0) {
              capResult.cancellations.forEach(id => cancelledIds.add(id));
              console.log(`🚫 Alert(s) cancelled: ${capResult.cancellations.join(', ')}`);
            }

            // Track superseded alert IDs (from Update messages)
            if (capResult.alerts) {
              for (const alert of capResult.alerts) {
                if (alert.supersedes && alert.supersedes.length > 0) {
                  alert.supersedes.forEach(id => supersededIds.add(id));
                  console.log(`🔄 Alert ${alert.id} supersedes: ${alert.supersedes.join(', ')}`);
                }
                allAlerts.push(alert);
              }
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (error) {
            console.warn(`Failed to fetch CAP file ${capFile}:`, error.message);
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch hour directory ${hour}:`, error.message);
      }
    }

    // Filter out cancelled and superseded alerts
    const activeAlerts = allAlerts.filter(alert => {
      if (cancelledIds.has(alert.id)) {
        console.log(`❌ Removing cancelled alert: ${alert.id}`);
        return false;
      }
      if (supersededIds.has(alert.id)) {
        console.log(`❌ Removing superseded alert: ${alert.id}`);
        return false;
      }
      return true;
    });

    console.log(`📋 ${allAlerts.length} total alerts, ${cancelledIds.size} cancelled, ${supersededIds.size} superseded, ${activeAlerts.length} active`);

    return activeAlerts;
  } catch (error) {
    // 404 is normal - means no alerts for this office today
    if (error.response?.status === 404) {
      console.log(`No alerts directory for ${office} on ${date} (this is normal)`);
      return [];
    }
    console.error(`Error fetching CAP alerts for ${office} on ${date}:`, error.message);
    return [];
  }
}

// EC forecast region mapping - maps forecast regions to geographic keywords
// Keywords that appear in reverse geocoding names for each EC forecast region
const EC_REGION_KEYWORDS = {
  // === BRITISH COLUMBIA ===
  // BC North Coast - IMPORTANT: coastal vs inland distinction
  'coastal': ['prince rupert', 'port edward', 'oona', 'porcher', 'digby', 'masset', 'haida', 'queen charlotte', 'sandspit', 'skidegate', 'tlell', 'south skeena'],
  'inland': ['terrace', 'kitimat', 'stewart', 'nass', 'lakelse', 'thornhill'],
  // BC Central/South Coast regions
  'central coast': ['bella coola', 'ocean falls', 'bella bella', 'klemtu', 'shearwater', 'hagensborg'],
  'north vancouver island': ['port hardy', 'port mcneill', 'port alice', 'alert bay', 'sointula', 'coal harbour'],
  'east vancouver island': ['nanaimo', 'parksville', 'qualicum', 'ladysmith', 'chemainus', 'duncan', 'lake cowichan', 'mill bay'],
  'west vancouver island': ['tofino', 'ucluelet', 'port alberni', 'bamfield', 'pacific rim', 'clayoquot'],
  'south vancouver island': ['victoria', 'sooke', 'sidney', 'saanich', 'metchosin', 'langford', 'colwood', 'oak bay', 'esquimalt'],
  'inland vancouver island': ['courtenay', 'comox', 'campbell river', 'gold river', 'sayward', 'cumberland'],
  'sunshine coast': ['gibsons', 'sechelt', 'powell river', 'texada', 'pender harbour', 'halfmoon bay'],
  // BC Interior regions
  'north thompson': ['clearwater', 'valemount', 'blue river', 'wells gray', 'barriere', 'little fort'],
  'south thompson': ['kamloops', 'chase', 'salmon arm', 'sicamous', 'sorrento', 'blind bay'],
  'north columbia': ['revelstoke', 'mica creek', 'glacier', 'rogers pass'],
  'west columbia': ['golden', 'field', 'yoho'],
  'east columbia': ['invermere', 'radium', 'fairmont', 'canal flats', 'kimberley', 'cranbrook', 'windermere'],
  'north okanagan': ['vernon', 'armstrong', 'enderby', 'lumby', 'coldstream', 'spallumcheen'],
  'central okanagan': ['kelowna', 'west kelowna', 'peachland', 'lake country', 'winfield'],
  'south okanagan': ['penticton', 'summerland', 'oliver', 'osoyoos', 'keremeos', 'naramata'],
  'similkameen': ['princeton', 'hedley', 'manning park', 'tulameen'],
  'boundary': ['grand forks', 'greenwood', 'rock creek', 'midway', 'christina lake'],
  'west kootenay': ['nelson', 'castlegar', 'trail', 'rossland', 'salmo', 'slocan', 'new denver', 'kaslo'],
  'east kootenay': ['fernie', 'sparwood', 'elkford', 'creston', 'cranbrook', 'jaffray'],
  // BC Lower Mainland / Fraser regions
  'metro vancouver': ['vancouver', 'burnaby', 'richmond', 'surrey', 'coquitlam', 'port coquitlam', 'port moody', 'new westminster', 'delta', 'langley', 'white rock', 'north vancouver', 'west vancouver', 'maple ridge', 'pitt meadows'],
  'fraser valley': ['abbotsford', 'chilliwack', 'mission', 'hope', 'agassiz', 'harrison', 'kent', 'yarrow'],
  'howe sound': ['squamish', 'whistler', 'pemberton', 'britannia', 'lions bay', 'brackendale'],
  // BC North regions
  'prince george': ['prince george', 'mackenzie', 'mcbride', 'bear lake'],
  'bulkley valley': ['smithers', 'houston', 'burns lake', 'telkwa', 'bulkley', 'topley'],
  'nechako': ['vanderhoof', 'fort fraser', 'fraser lake', 'fort st james'],
  'cariboo': ['williams lake', 'quesnel', '100 mile', '150 mile', 'lac la hache', 'horsefly'],
  'chilcotin': ['alexis creek', 'anahim lake', 'tatla lake', 'nimpo lake', 'kleena kleene'],
  'peace river': ['fort st john', 'dawson creek', 'chetwynd', 'hudson hope', 'fort nelson', 'tumbler ridge', 'taylor', 'pouce coupe'],

  // === ONTARIO ===
  // Southern Ontario
  'city of toronto': ['toronto', 'scarborough', 'etobicoke', 'north york', 'york'],
  'york - durham': ['markham', 'vaughan', 'richmond hill', 'aurora', 'newmarket', 'oshawa', 'whitby', 'ajax', 'pickering', 'uxbridge', 'stouffville'],
  'peel - halton': ['mississauga', 'brampton', 'oakville', 'burlington', 'milton', 'halton hills', 'georgetown', 'caledon'],
  'hamilton - niagara': ['hamilton', 'st. catharines', 'niagara falls', 'welland', 'grimsby', 'stoney creek', 'dundas', 'ancaster', 'fort erie', 'port colborne'],
  'waterloo - wellington': ['kitchener', 'waterloo', 'cambridge', 'guelph', 'fergus', 'elora', 'elmira'],
  'london - middlesex': ['london', 'strathroy', 'st. thomas', 'aylmer'],
  'windsor - essex': ['windsor', 'leamington', 'amherstburg', 'tecumseh', 'lakeshore', 'essex', 'kingsville'],
  'chatham-kent - lambton': ['chatham', 'sarnia', 'wallaceburg', 'petrolia', 'point edward'],
  'huron - perth': ['stratford', 'goderich', 'st. marys', 'clinton', 'seaforth', 'exeter', 'listowel'],
  'grey - bruce': ['owen sound', 'hanover', 'walkerton', 'port elgin', 'southampton', 'kincardine', 'meaford', 'thornbury', 'wiarton', 'tobermory'],
  'simcoe - muskoka': ['barrie', 'orillia', 'collingwood', 'midland', 'penetanguishene', 'wasaga beach', 'gravenhurst', 'bracebridge', 'huntsville', 'innisfil', 'alliston', 'angus', 'muskoka'],
  'kawartha - haliburton': ['peterborough', 'lindsay', 'cobourg', 'port hope', 'haliburton', 'minden', 'bancroft', 'bobcaygeon', 'fenelon falls'],
  'quinte - kingston': ['belleville', 'kingston', 'trenton', 'napanee', 'picton', 'prince edward county', 'gananoque', 'brockville'],
  'ottawa - gatineau': ['ottawa', 'kanata', 'orleans', 'nepean', 'gloucester', 'vanier', 'gatineau'],
  'prescott - russell': ['hawkesbury', 'rockland', 'casselman', 'embrun'],
  'stormont - dundas': ['cornwall', 'morrisburg', 'winchester', 'chesterville'],
  'renfrew - pembroke': ['pembroke', 'petawawa', 'arnprior', 'renfrew', 'deep river', 'chalk river', 'barry\'s bay'],
  // Central Ontario
  'parry sound - nipissing': ['north bay', 'parry sound', 'mattawa', 'sturgeon falls', 'powassan', 'sundridge', 'burk\'s falls'],
  'sudbury': ['sudbury', 'greater sudbury', 'espanola', 'manitoulin', 'capreol', 'valley east'],
  'algoma - sault ste. marie': ['sault ste. marie', 'elliot lake', 'blind river', 'wawa', 'white river', 'hornepayne'],
  // Northern Ontario
  'thunder bay': ['thunder bay', 'nipigon', 'marathon', 'terrace bay', 'schreiber'],
  'kenora - rainy river': ['kenora', 'fort frances', 'dryden', 'sioux lookout', 'red lake', 'ear falls'],
  'timmins - cochrane': ['timmins', 'cochrane', 'kapuskasing', 'hearst', 'smooth rock falls', 'iroquois falls'],
  'kirkland lake - temiskaming': ['kirkland lake', 'new liskeard', 'temiskaming shores', 'englehart', 'cobalt', 'haileybury'],
  // Far Northern Ontario (EC forecast regions)
  'sandy lake': ['sandy lake', 'weagamow', 'deer lake', 'north caribou', 'keewaywin'],
  'pikangikum': ['pikangikum', 'poplar hill', 'macdowell', 'north spirit lake'],
  'pickle lake': ['pickle lake', 'cat lake', 'mishkeegogamang', 'osnaburgh'],
  'moosonee': ['moosonee', 'moose factory', 'attawapiskat', 'kashechewan', 'fort albany'],
  'big trout lake': ['big trout lake', 'kitchenuhmaykoosib', 'kii', 'sachigo lake', 'bearskin lake', 'kasabonika'],
  'peawanuck': ['peawanuck', 'fort severn', 'weenusk'],

  // === ALBERTA ===
  'edmonton metro': ['edmonton', 'st. albert', 'sherwood park', 'spruce grove', 'stony plain', 'leduc', 'beaumont', 'fort saskatchewan'],
  'calgary metro': ['calgary', 'airdrie', 'cochrane', 'okotoks', 'chestermere', 'strathmore', 'high river'],
  'red deer': ['red deer', 'innisfail', 'sylvan lake', 'lacombe', 'ponoka', 'blackfalds'],
  'lethbridge': ['lethbridge', 'coaldale', 'taber', 'picture butte', 'cardston', 'pincher creek', 'fort macleod'],
  'medicine hat': ['medicine hat', 'brooks', 'redcliff', 'bow island'],
  'grande prairie': ['grande prairie', 'beaverlodge', 'sexsmith', 'wembley', 'clairmont'],
  'fort mcmurray': ['fort mcmurray', 'wood buffalo', 'anzac', 'fort chipewyan'],
  'banff - jasper': ['banff', 'jasper', 'canmore', 'lake louise', 'kananaskis'],
  'lloydminster': ['lloydminster', 'vermilion', 'wainwright', 'provost'],
  'wetaskiwin - camrose': ['wetaskiwin', 'camrose', 'drayton valley', 'devon'],
  'peace river alberta': ['peace river', 'high level', 'fairview', 'grimshaw', 'manning'],

  // === SASKATCHEWAN ===
  'saskatoon': ['saskatoon', 'warman', 'martensville', 'osler', 'dalmeny', 'langham'],
  'regina': ['regina', 'moose jaw', 'lumsden', 'white city', 'pilot butte', 'balgonie'],
  'prince albert': ['prince albert', 'la ronge', 'nipawin', 'melfort'],
  'swift current': ['swift current', 'maple creek', 'shaunavon'],
  'yorkton': ['yorkton', 'melville', 'canora', 'esterhazy'],
  'north battleford': ['north battleford', 'battleford', 'unity', 'lloydminster'],
  'estevan': ['estevan', 'weyburn', 'carlyle', 'oxbow'],

  // === MANITOBA ===
  'winnipeg': ['winnipeg', 'steinbach', 'selkirk', 'stonewall', 'beausejour', 'headingley'],
  'brandon': ['brandon', 'portage la prairie', 'carberry', 'souris', 'virden'],
  'thompson': ['thompson', 'flin flon', 'the pas', 'snow lake'],
  'dauphin': ['dauphin', 'swan river', 'roblin', 'grandview'],
  'morden - winkler': ['morden', 'winkler', 'altona', 'carman', 'morris'],

  // === QUEBEC ===
  'montreal': ['montreal', 'laval', 'longueuil', 'brossard', 'terrebonne', 'repentigny', 'st-jean-sur-richelieu', 'blainville'],
  'quebec city': ['quebec', 'lévis', 'beauport', 'charlesbourg', 'ste-foy', 'cap-rouge'],
  'gatineau': ['gatineau', 'hull', 'aylmer'],
  'sherbrooke': ['sherbrooke', 'magog', 'granby', 'drummondville'],
  'trois-rivières': ['trois-rivières', 'shawinigan', 'victoriaville'],
  'saguenay': ['saguenay', 'chicoutimi', 'jonquière', 'alma', 'roberval'],
  'rimouski': ['rimouski', 'rivière-du-loup', 'matane', 'mont-joli'],
  'sept-îles': ['sept-îles', 'baie-comeau', 'port-cartier', 'havre-saint-pierre'],
  'val-d\'or': ['val-d\'or', 'rouyn-noranda', 'amos', 'la sarre'],
  'gaspé': ['gaspé', 'percé', 'chandler', 'new richmond', 'carleton'],

  // === ATLANTIC PROVINCES ===
  // New Brunswick
  'saint john': ['saint john', 'quispamsis', 'rothesay', 'grand bay-westfield'],
  'moncton': ['moncton', 'dieppe', 'riverview', 'shediac'],
  'fredericton': ['fredericton', 'oromocto', 'new maryland'],
  'bathurst - miramichi': ['bathurst', 'miramichi', 'campbellton', 'dalhousie', 'caraquet'],
  'edmundston': ['edmundston', 'grand falls', 'woodstock', 'hartland'],
  // Nova Scotia
  'halifax': ['halifax', 'dartmouth', 'bedford', 'sackville', 'cole harbour'],
  'cape breton': ['sydney', 'glace bay', 'new waterford', 'north sydney', 'port hawkesbury'],
  'truro - amherst': ['truro', 'amherst', 'new glasgow', 'stellarton', 'pictou'],
  'yarmouth - digby': ['yarmouth', 'digby', 'shelburne', 'barrington'],
  'annapolis valley': ['kentville', 'wolfville', 'berwick', 'middleton', 'bridgetown', 'annapolis royal'],
  // Prince Edward Island
  'charlottetown': ['charlottetown', 'stratford', 'cornwall'],
  'summerside': ['summerside', 'kensington', 'alberton', 'tignish'],
  // Newfoundland and Labrador
  'st. john\'s': ['st. john\'s', 'mount pearl', 'conception bay south', 'paradise', 'torbay'],
  'corner brook': ['corner brook', 'stephenville', 'port aux basques', 'deer lake'],
  'gander - grand falls': ['gander', 'grand falls-windsor', 'lewisporte', 'twillingate'],
  'labrador': ['happy valley-goose bay', 'labrador city', 'wabush', 'churchill falls'],
};

/**
 * Check if an alert's coverage area matches the user's location
 * Uses keyword matching between EC forecast regions and geocoding location names
 * Returns the matched area name if found, null if no match
 */
function alertMatchesLocation(alert, locationName) {
  if (!alert.areas || alert.areas.length === 0) {
    // Province-wide alert or no areas specified - show it
    console.log(`📍 Alert "${alert.title}" has no specific areas - showing`);
    return { matched: true, matchedArea: null };
  }

  if (!locationName) {
    // No location to filter by - show the alert
    return { matched: true, matchedArea: null };
  }

  const normalizedLocation = locationName.toLowerCase();
  console.log(`🔍 Checking if "${alert.title}" applies to "${locationName}"`);
  console.log(`   Alert areas: ${alert.areas.join(', ')}`);

  // Check each area in the alert
  for (const area of alert.areas) {
    const normalizedArea = area.toLowerCase();

    // Direct match - location name appears in area description
    if (normalizedArea.includes(normalizedLocation)) {
      console.log(`   ✅ Direct match: location in area "${area}"`);
      return { matched: true, matchedArea: area };
    }

    // Check for coastal vs inland distinction (critical for North Coast)
    const isCoastalAlert = normalizedArea.includes('coastal');
    const isInlandAlert = normalizedArea.includes('inland');

    // If alert specifies coastal/inland, check those keywords first
    if (isCoastalAlert) {
      const coastalKeywords = EC_REGION_KEYWORDS['coastal'] || [];
      for (const keyword of coastalKeywords) {
        if (normalizedLocation.includes(keyword)) {
          console.log(`   ✅ Coastal match: "${area}" matches via "${keyword}"`);
          return { matched: true, matchedArea: area };
        }
      }
      // If it's specifically a coastal alert but no coastal keywords matched, skip other checks for this area
      continue;
    }

    if (isInlandAlert) {
      const inlandKeywords = EC_REGION_KEYWORDS['inland'] || [];
      for (const keyword of inlandKeywords) {
        if (normalizedLocation.includes(keyword)) {
          console.log(`   ✅ Inland match: "${area}" matches via "${keyword}"`);
          return { matched: true, matchedArea: area };
        }
      }
      // If it's specifically an inland alert but no inland keywords matched, skip other checks for this area
      continue;
    }

    // Check against other EC region keywords
    for (const [region, keywords] of Object.entries(EC_REGION_KEYWORDS)) {
      // Skip coastal/inland as they're handled above
      if (region === 'coastal' || region === 'inland') continue;

      // Does the alert area match this EC region?
      if (normalizedArea.includes(region)) {
        // Check if user's location matches any keywords for this region
        for (const keyword of keywords) {
          if (normalizedLocation.includes(keyword)) {
            console.log(`   ✅ Region match: "${area}" matches location via keyword "${keyword}"`);
            return { matched: true, matchedArea: area };
          }
        }
      }
    }
  }

  console.log(`   ❌ No match - alert doesn't apply to this location`);
  return { matched: false, matchedArea: null };
}

/**
 * Main function to fetch weather alerts using CAP format
 */
export async function fetchWeatherAlerts(provinceCode, lat = null, lon = null, locationName = null) {
  try {
    console.log(`🚨 Fetching CAP weather alerts for province: ${provinceCode}, location: ${locationName}`);

    // Get today's date in YYYYMMDD format (UTC)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Determine which offices to check - ONLY the province's office
    const primaryOffice = getResponsibleOfficeForProvince(provinceCode);

    if (!primaryOffice) {
      console.log(`No office found for province ${provinceCode}`);
      return [];
    }

    // Only fetch from the province's office
    let allAlerts = [];
    try {
      const alerts = await fetchCapAlertsForDate(dateStr, primaryOffice);
      allAlerts.push(...alerts);
    } catch (error) {
      console.warn(`Failed to fetch alerts from ${primaryOffice}:`, error.message);
    }

    // Deduplicate alerts by ID
    let uniqueAlerts = allAlerts.filter((alert, index, self) =>
      index === self.findIndex(a => a.id === alert.id)
    );

    console.log(`📋 Found ${uniqueAlerts.length} alerts from ${primaryOffice} for ${provinceCode.toUpperCase()}`);

    // Filter alerts by location using keyword matching and add matched area
    if (locationName && uniqueAlerts.length > 0) {
      const filteredAlerts = [];
      for (const alert of uniqueAlerts) {
        const matchResult = alertMatchesLocation(alert, locationName);
        if (matchResult.matched) {
          // Add the matched area to the alert for display purposes
          alert.matchedArea = matchResult.matchedArea;
          filteredAlerts.push(alert);
        }
      }
      console.log(`📍 After location filtering: ${filteredAlerts.length} of ${uniqueAlerts.length} alerts apply to "${locationName}"`);
      uniqueAlerts = filteredAlerts;
    }

    console.log(`✅ Returning ${uniqueAlerts.length} alerts for ${locationName || provinceCode.toUpperCase()}`);
    return uniqueAlerts;

  } catch (error) {
    console.error('Critical error in fetchWeatherAlerts:', error);
    return [];
  }
}

/**
 * Legacy function for backward compatibility - fetch alert details (no longer needed with CAP)
 */
export async function fetchAlertDetails(alertUrl) {
  console.warn('fetchAlertDetails is deprecated with CAP format');
  return null;
}

/**
 * Parse EC color from title (legacy function)
 */
function parseECColorFromTitle(title) {
  if (!title) return { color: 'GREY', severity: 'Minor', type: 'STATEMENT' };
  const t = title.toUpperCase();
  if (t.startsWith('RED')) return { color: 'RED', severity: 'Severe', type: 'WARNING' };
  if (t.startsWith('YELLOW')) return { color: 'YELLOW', severity: 'Moderate', type: 'WATCH' };
  if (t.startsWith('GREY') || t.startsWith('GRAY')) return { color: 'GREY', severity: 'Minor', type: 'STATEMENT' };
  if (t.startsWith('ORANGE')) return { color: 'ORANGE', severity: 'Moderate', type: 'ADVISORY' };
  if (t.includes('WARNING')) return { color: 'RED', severity: 'Severe', type: 'WARNING' };
  if (t.includes('WATCH')) return { color: 'YELLOW', severity: 'Moderate', type: 'WATCH' };
  return { color: 'GREY', severity: 'Minor', type: 'STATEMENT' };
}

export function getAlertType(title) {
  return parseECColorFromTitle(title);
}

export function generateFallbackAlerts() { 
  return []; 
}

export function getProvinceCodes() {
  return {
    'NL': 'Newfoundland and Labrador', 'PE': 'Prince Edward Island', 'NS': 'Nova Scotia',
    'NB': 'New Brunswick', 'QC': 'Quebec', 'ON': 'Ontario', 'MB': 'Manitoba',
    'SK': 'Saskatchewan', 'AB': 'Alberta', 'BC': 'British Columbia',
    'YT': 'Yukon', 'NT': 'Northwest Territories', 'NU': 'Nunavut'
  };
}

const environmentCanadaApi = { 
  fetchWeatherAlerts, 
  fetchAlertDetails, 
  getAlertType, 
  EC_ALERT_COLORS, 
  getProvinceCodes, 
  generateFallbackAlerts 
};

export default environmentCanadaApi;
