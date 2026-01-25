const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Service de détection et prévention de la fraude
 * Analyse les patterns de scan et détecte les comportements suspects
 */
class FraudDetectionService {
  constructor() {
    this.suspiciousPatterns = new Map();
    this.blockedIPs = new Set();
    this.scanHistory = new Map();
    this.initializePatterns();
  }

  /**
   * Initialise les patterns de fraude
   */
  initializePatterns() {
    // Pattern: scans multiples rapides (possible bot)
    this.suspiciousPatterns.set('rapid_scans', {
      threshold: 5, // scans en moins de 10 secondes
      timeWindow: 10000, // 10 secondes
      severity: 'high',
      action: 'block_temporary'
    });

    // Pattern: même ticket scanné depuis plusieurs locations
    this.suspiciousPatterns.set('location_hopping', {
      threshold: 3, // locations différentes
      timeWindow: 300000, // 5 minutes
      severity: 'medium',
      action: 'flag_for_review'
    });

    // Pattern: scans cycliques (même ticket toutes les X minutes)
    this.suspiciousPatterns.set('cyclic_scans', {
      threshold: 3, // scans répétitifs
      interval: 60000, // 1 minute entre scans
      severity: 'medium',
      action: 'flag_for_review'
    });

    // Pattern: volume anormal de scans par IP
    this.suspiciousPatterns.set('volume_anomaly', {
      threshold: 100, // scans par heure
      timeWindow: 3600000, // 1 heure
      severity: 'high',
      action: 'block_ip'
    });

    // Pattern: scans en dehors des heures d'événement
    this.suspiciousPatterns.set('off_hours_scans', {
      startHour: 2, // 2h du matin
      endHour: 5, // 5h du matin
      severity: 'medium',
      action: 'flag_for_review'
    });
  }

  /**
   * Analyse un scan pour détecter la fraude
   * @param {Object} scanData - Données du scan
   * @param {Object} context - Contexte du scan
   * @returns {Promise<Object>} Résultat de l'analyse
   */
  async analyzeScan(scanData, context = {}) {
    const analysis = {
      isSuspicious: false,
      fraudFlags: [],
      riskScore: 0,
      recommendations: []
    };

    try {
      // Analyser les patterns suspects
      const rapidScanAnalysis = this.analyzeRapidScans(scanData, context);
      if (rapidScanAnalysis.flagged) {
        analysis.fraudFlags.push(rapidScanAnalysis);
        analysis.riskScore += rapidScanAnalysis.score;
      }

      const locationAnalysis = this.analyzeLocationHopping(scanData, context);
      if (locationAnalysis.flagged) {
        analysis.fraudFlags.push(locationAnalysis);
        analysis.riskScore += locationAnalysis.score;
      }

      const volumeAnalysis = this.analyzeVolumeAnomaly(scanData, context);
      if (volumeAnalysis.flagged) {
        analysis.fraudFlags.push(volumeAnalysis);
        analysis.riskScore += volumeAnalysis.score;
      }

      const timeAnalysis = this.analyzeOffHoursScans(scanData, context);
      if (timeAnalysis.flagged) {
        analysis.fraudFlags.push(timeAnalysis);
        analysis.riskScore += timeAnalysis.score;
      }

      const cyclicAnalysis = this.analyzeCyclicScans(scanData, context);
      if (cyclicAnalysis.flagged) {
        analysis.fraudFlags.push(cyclicAnalysis);
        analysis.riskScore += cyclicAnalysis.score;
      }

      // Analyser les métadonnées suspectes
      const metadataAnalysis = this.analyzeMetadata(scanData, context);
      if (metadataAnalysis.flagged) {
        analysis.fraudFlags.push(metadataAnalysis);
        analysis.riskScore += metadataAnalysis.score;
      }

      // Déterminer si le scan est suspect
      analysis.isSuspicious = analysis.fraudFlags.length > 0 || analysis.riskScore > 50;

      // Générer des recommandations
      analysis.recommendations = this.generateRecommendations(analysis);

      // Mettre à jour l'historique
      this.updateScanHistory(scanData, context, analysis);

      logger.info('Fraud analysis completed', {
        ticketId: scanData.ticketId,
        isSuspicious: analysis.isSuspicious,
        riskScore: analysis.riskScore,
        flagsCount: analysis.fraudFlags.length
      });

      return analysis;
    } catch (error) {
      logger.error('Fraud analysis failed', {
        error: error.message,
        ticketId: scanData.ticketId
      });
      
      return {
        isSuspicious: false,
        fraudFlags: [],
        riskScore: 0,
        recommendations: ['retry_analysis'],
        error: error.message
      };
    }
  }

  /**
   * Analyse les scans rapides (possible bot)
   */
  analyzeRapidScans(scanData, context) {
    const pattern = this.suspiciousPatterns.get('rapid_scans');
    const now = Date.now();
    const key = `${scanData.ticketId}_${context.ipAddress}`;

    if (!this.scanHistory.has(key)) {
      this.scanHistory.set(key, []);
    }

    const history = this.scanHistory.get(key);
    history.push(now);

    // Nettoyer les anciens scans
    const cutoff = now - pattern.timeWindow;
    const recentScans = history.filter(timestamp => timestamp > cutoff);
    this.scanHistory.set(key, recentScans);

    if (recentScans.length >= pattern.threshold) {
      return {
        type: 'rapid_scans',
        flagged: true,
        score: 40,
        severity: pattern.severity,
        details: {
          scanCount: recentScans.length,
          timeWindow: pattern.timeWindow,
          scans: recentScans
        },
        action: pattern.action
      };
    }

    return { type: 'rapid_scans', flagged: false, score: 0 };
  }

  /**
   * Analyse les sauts de location (même ticket scanné depuis plusieurs endroits)
   */
  analyzeLocationHopping(scanData, context) {
    const pattern = this.suspiciousPatterns.get('location_hopping');
    const key = scanData.ticketId;

    if (!this.scanHistory.has(`locations_${key}`)) {
      this.scanHistory.set(`locations_${key}`, new Map());
    }

    const locationHistory = this.scanHistory.get(`locations_${key}`);
    const now = Date.now();

    if (!locationHistory.has(context.location)) {
      locationHistory.set(context.location, []);
    }
    locationHistory.get(context.location).push(now);

    // Nettoyer les anciennes locations
    for (const [location, timestamps] of locationHistory.entries()) {
      const recent = timestamps.filter(timestamp => timestamp > (now - pattern.timeWindow));
      if (recent.length === 0) {
        locationHistory.delete(location);
      } else {
        locationHistory.set(location, recent);
      }
    }

    if (locationHistory.size >= pattern.threshold) {
      return {
        type: 'location_hopping',
        flagged: true,
        score: 30,
        severity: pattern.severity,
        details: {
          locationCount: locationHistory.size,
          locations: Array.from(locationHistory.keys()),
          timeWindow: pattern.timeWindow
        },
        action: pattern.action
      };
    }

    return { type: 'location_hopping', flagged: false, score: 0 };
  }

  /**
   * Analyse les anomalies de volume par IP
   */
  analyzeVolumeAnomaly(scanData, context) {
    const pattern = this.suspiciousPatterns.get('volume_anomaly');
    const key = `volume_${context.ipAddress}`;
    const now = Date.now();

    if (!this.scanHistory.has(key)) {
      this.scanHistory.set(key, []);
    }

    const history = this.scanHistory.get(key);
    history.push(now);

    // Nettoyer les anciens scans
    const cutoff = now - pattern.timeWindow;
    const recentScans = history.filter(timestamp => timestamp > cutoff);
    this.scanHistory.set(key, recentScans);

    if (recentScans.length >= pattern.threshold) {
      return {
        type: 'volume_anomaly',
        flagged: true,
        score: 50,
        severity: pattern.severity,
        details: {
          scanCount: recentScans.length,
          timeWindow: pattern.timeWindow,
          ipAddress: context.ipAddress
        },
        action: pattern.action
      };
    }

    return { type: 'volume_anomaly', flagged: false, score: 0 };
  }

  /**
   * Analyse les scans en dehors des heures d'événement
   */
  analyzeOffHoursScans(scanData, context) {
    const pattern = this.suspiciousPatterns.get('off_hours_scans');
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour >= pattern.startHour && currentHour <= pattern.endHour) {
      return {
        type: 'off_hours_scans',
        flagged: true,
        score: 20,
        severity: pattern.severity,
        details: {
          scanTime: now.toISOString(),
          scanHour: currentHour,
          suspiciousWindow: `${pattern.startHour}h - ${pattern.endHour}h`
        },
        action: pattern.action
      };
    }

    return { type: 'off_hours_scans', flagged: false, score: 0 };
  }

  /**
   * Analyse les scans cycliques (répétitifs)
   */
  analyzeCyclicScans(scanData, context) {
    const pattern = this.suspiciousPatterns.get('cyclic_scans');
    const key = `cyclic_${scanData.ticketId}`;
    const now = Date.now();

    if (!this.scanHistory.has(key)) {
      this.scanHistory.set(key, []);
    }

    const history = this.scanHistory.get(key);
    history.push(now);

    // Garder seulement les 10 derniers scans
    if (history.length > 10) {
      history.shift();
    }

    if (history.length >= pattern.threshold) {
      // Calculer les intervalles entre scans
      const intervals = [];
      for (let i = 1; i < history.length; i++) {
        intervals.push(history[i] - history[i - 1]);
      }

      // Vérifier si les intervalles sont réguliers
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervals.length;

      // Faible variance = scans réguliers = suspect
      if (variance < (avgInterval * 0.2)) { // 20% de tolérance
        return {
          type: 'cyclic_scans',
          flagged: true,
          score: 25,
          severity: pattern.severity,
          details: {
            scanCount: history.length,
            avgInterval: Math.round(avgInterval),
            variance: Math.round(variance),
            intervals: intervals.map(i => Math.round(i))
          },
          action: pattern.action
        };
      }
    }

    return { type: 'cyclic_scans', flagged: false, score: 0 };
  }

  /**
   * Analyse les métadonnées suspectes
   */
  analyzeMetadata(scanData, context) {
    let score = 0;
    const flags = [];

    // Vérifier les user agents suspects
    if (context.userAgent) {
      const suspiciousAgents = ['bot', 'crawler', 'scraper', 'spider'];
      const userAgent = context.userAgent.toLowerCase();
      
      for (const agent of suspiciousAgents) {
        if (userAgent.includes(agent)) {
          score += 15;
          flags.push(`suspicious_user_agent_${agent}`);
        }
      }
    }

    // Vérifier les IPs suspectes
    if (context.ipAddress) {
      // IPs privées ou proxies
      const privateIPs = ['127.0.0.1', '::1', 'localhost'];
      if (privateIPs.includes(context.ipAddress)) {
        score += 10;
        flags.push('private_ip_scan');
      }
    }

    // Vérifier les timestamps anormaux
    if (scanData.timestamp) {
      const scanTime = new Date(scanData.timestamp);
      const now = new Date();
      const timeDiff = Math.abs(now - scanTime);

      // Timestamp dans le futur ou trop ancien
      if (timeDiff > 60000) { // Plus d'une minute de différence
        score += 10;
        flags.push('timestamp_anomaly');
      }
    }

    if (score > 0) {
      return {
        type: 'metadata_anomaly',
        flagged: true,
        score,
        severity: score > 25 ? 'high' : 'medium',
        details: {
          flags,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
          timestamp: scanData.timestamp
        },
        action: score > 25 ? 'flag_for_review' : 'log_only'
      };
    }

    return { type: 'metadata_anomaly', flagged: false, score: 0 };
  }

  /**
   * Génère des recommandations basées sur l'analyse
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.riskScore >= 80) {
      recommendations.push('block_scan');
      recommendations.push('notify_security');
    } else if (analysis.riskScore >= 60) {
      recommendations.push('require_additional_verification');
      recommendations.push('flag_for_manual_review');
    } else if (analysis.riskScore >= 40) {
      recommendations.push('increase_monitoring');
      recommendations.push('log_detailed_scan');
    } else if (analysis.riskScore >= 20) {
      recommendations.push('monitor_closely');
    }

    // Recommandations spécifiques aux types de fraude
    for (const flag of analysis.fraudFlags) {
      switch (flag.type) {
        case 'rapid_scans':
          recommendations.push('implement_rate_limiting');
          break;
        case 'location_hopping':
          recommendations.push('verify_ticket_ownership');
          break;
        case 'volume_anomaly':
          recommendations.push('block_temporary_ip');
          break;
        case 'off_hours_scans':
          recommendations.push('verify_event_schedule');
          break;
        case 'cyclic_scans':
          recommendations.push('investigate_automation');
          break;
      }
    }

    return [...new Set(recommendations)]; // Éliminer les doublons
  }

  /**
   * Met à jour l'historique des scans
   */
  updateScanHistory(scanData, context, analysis) {
    const historyKey = `analysis_${scanData.ticketId}`;
    
    if (!this.scanHistory.has(historyKey)) {
      this.scanHistory.set(historyKey, []);
    }

    const history = this.scanHistory.get(historyKey);
    history.push({
      timestamp: Date.now(),
      analysis,
      context
    });

    // Garder seulement les 50 analyses les plus récentes
    if (history.length > 50) {
      history.shift();
    }
  }

  /**
   * Vérifie si une IP est bloquée
   */
  isIPBlocked(ipAddress) {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Bloque une IP temporairement
   */
  blockIP(ipAddress, duration = 3600000) { // 1 heure par défaut
    this.blockedIPs.add(ipAddress);
    
    setTimeout(() => {
      this.blockedIPs.delete(ipAddress);
      logger.info('IP unblocked', { ipAddress });
    }, duration);

    logger.security('IP blocked due to suspicious activity', {
      ipAddress,
      duration,
      blockedAt: new Date().toISOString()
    });
  }

  /**
   * Récupère les statistiques de fraude
   */
  getFraudStats() {
    const stats = {
      totalScans: 0,
      suspiciousScans: 0,
      blockedIPs: this.blockedIPs.size,
      activePatterns: 0,
      riskDistribution: {
        low: 0,
        medium: 0,
        high: 0
      }
    };

    // Analyser l'historique pour les statistiques
    for (const [key, history] of this.scanHistory.entries()) {
      if (key.startsWith('analysis_')) {
        for (const entry of history) {
          stats.totalScans++;
          if (entry.analysis.isSuspicious) {
            stats.suspiciousScans++;
            
            // Distribution des risques
            if (entry.analysis.riskScore < 30) {
              stats.riskDistribution.low++;
            } else if (entry.analysis.riskScore < 60) {
              stats.riskDistribution.medium++;
            } else {
              stats.riskDistribution.high++;
            }
          }
        }
      }
    }

    return stats;
  }

  /**
   * Nettoie l'historique ancien
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - (24 * 60 * 60 * 1000); // 24 heures

    for (const [key, history] of this.scanHistory.entries()) {
      if (key.startsWith('analysis_')) {
        const recent = history.filter(entry => entry.timestamp > cutoff);
        this.scanHistory.set(key, recent);
      }
    }

    logger.info('Fraud detection cleanup completed');
  }
}

module.exports = new FraudDetectionService();
