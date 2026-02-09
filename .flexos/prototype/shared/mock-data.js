/**
 * COMPASS Mock Database — CRUD Interface for Prototypes
 *
 * Loads mock-data.json and provides in-memory CRUD operations.
 * Auto-initializes on DOMContentLoaded, dispatches 'mockdb:ready' event.
 *
 * Usage in prototypes:
 *   document.addEventListener('mockdb:ready', () => {
 *     const users = mockDb.getAll('users');
 *     const currentUser = mockDb.getCurrentUser();
 *   });
 */

const mockDb = (() => {
  let data = null;
  let initialized = false;

  return {
    /**
     * Initialize the database from mock-data.json
     */
    async init() {
      if (initialized) return data;
      try {
        const response = await fetch('../shared/mock-data.json');
        data = await response.json();
        initialized = true;
        document.dispatchEvent(new CustomEvent('mockdb:ready', { detail: data }));
        return data;
      } catch (err) {
        console.error('[mockDb] Failed to load mock-data.json:', err);
        return null;
      }
    },

    /**
     * Get all records from a collection
     * @param {string} collection — collection name (e.g., 'users', 'duty_logs')
     * @returns {Array} — array of records
     */
    getAll(collection) {
      if (!data || !data[collection]) return [];
      return Array.isArray(data[collection]) ? [...data[collection]] : [data[collection]];
    },

    /**
     * Get a single record by ID
     * @param {string} collection
     * @param {string} id
     * @returns {Object|null}
     */
    getById(collection, id) {
      const records = this.getAll(collection);
      return records.find(r => r.id === id) || null;
    },

    /**
     * Query records with a filter function
     * @param {string} collection
     * @param {Function} filterFn — function(record) => boolean
     * @returns {Array}
     */
    query(collection, filterFn) {
      return this.getAll(collection).filter(filterFn);
    },

    /**
     * Create a new record (in-memory only)
     * @param {string} collection
     * @param {Object} item — record data (id will be auto-generated if not provided)
     * @returns {Object} — the created record
     */
    create(collection, item) {
      if (!data[collection]) data[collection] = [];
      const record = {
        id: item.id || `${collection.slice(0, 4)}-${Date.now().toString(36)}`,
        ...item,
      };
      data[collection].push(record);
      return record;
    },

    /**
     * Update a record (in-memory only)
     * @param {string} collection
     * @param {string} id
     * @param {Object} updates — partial fields to merge
     * @returns {Object|null} — the updated record or null if not found
     */
    update(collection, id, updates) {
      const records = data[collection];
      if (!records) return null;
      const index = records.findIndex(r => r.id === id);
      if (index === -1) return null;
      records[index] = { ...records[index], ...updates };
      return records[index];
    },

    /**
     * Delete a record (in-memory only)
     * @param {string} collection
     * @param {string} id
     * @returns {boolean} — true if deleted, false if not found
     */
    delete(collection, id) {
      const records = data[collection];
      if (!records) return false;
      const index = records.findIndex(r => r.id === id);
      if (index === -1) return false;
      records.splice(index, 1);
      return true;
    },

    /**
     * Get the current authenticated user
     * @returns {Object|null}
     */
    getCurrentUser() {
      if (!data) return null;
      return this.getById('users', data.currentUser);
    },

    /**
     * Get raw data object (for debugging)
     */
    getRaw() {
      return data;
    },
  };
})();


/**
 * COMPASS Mock Helpers — Domain-Specific Query Shortcuts
 *
 * Convenience methods derived from the most common queries in COMPASS flows.
 */
const mockHelpers = {
  /**
   * Get all chaplains (isChaplain === true)
   */
  getChaplains() {
    return mockDb.query('users', u => u.isChaplain);
  },

  /**
   * Get currently on-duty chaplains
   */
  getOnDutyChaplains() {
    return mockDb.query('users', u => u.isChaplain && u.onDuty);
  },

  /**
   * Get users by role
   * @param {string} role — 'admin', 'chaplain', 'intern', 'support'
   */
  getUsersByRole(role) {
    return mockDb.query('users', u => u.role === role);
  },

  /**
   * Get interns
   */
  getInterns() {
    return mockDb.query('users', u => u.isIntern);
  },

  /**
   * Get unpaid duty logs (for stipend processing)
   * @param {number} [month] — 1-indexed month number
   * @param {number} [year]
   */
  getUnpaidDutyLogs(month, year) {
    return mockDb.query('duty_logs', log => {
      if (log.isPaid) return false;
      if (month && year) {
        const d = new Date(log.startTime);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      }
      return true;
    });
  },

  /**
   * Get duty logs for a specific chaplain
   * @param {string} userId
   */
  getDutyLogsForChaplain(userId) {
    return mockDb.query('duty_logs', log => log.userId === userId);
  },

  /**
   * Get duty logs for a specific week
   * @param {number} week — ISO week number
   * @param {number} year
   */
  getDutyLogsByWeek(week, year) {
    return mockDb.query('duty_logs', log => log.week === week && log.year === year);
  },

  /**
   * Get coverage schedule for a specific week
   * @param {number} week
   * @param {number} year
   */
  getCoverageSchedule(week, year) {
    return mockDb.query('coverage_schedules', s => s.weekNumber === week && s.year === year)[0] || null;
  },

  /**
   * Calculate coverage gaps (hours with no coverage)
   * @param {Object} schedule — coverage schedule object
   * @returns {Array} — array of { day, hour } objects for empty slots
   */
  getCoverageGaps(schedule) {
    if (!schedule || !schedule.slots) return [];
    const gaps = [];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
      const slots = schedule.slots[day] || {};
      for (let hour = 5; hour <= 21; hour++) {
        if (!slots[String(hour)]) {
          gaps.push({ day, hour });
        }
      }
    });
    return gaps;
  },

  /**
   * Get payouts for a chaplain
   * @param {string} chaplainId
   */
  getPayoutsForChaplain(chaplainId) {
    return mockDb.query('chaplain_payouts', p => p.chaplainId === chaplainId);
  },

  /**
   * Get stipend records for a specific period
   * @param {string} month — month name (e.g., 'January')
   * @param {number} year
   */
  getStipendRecords(month, year) {
    return mockDb.query('stipend_records', r => r.monthName === month && r.year === year);
  },

  /**
   * Calculate total stipend amount for a chaplain (all-time)
   * @param {string} chaplainId
   */
  getTotalStipendForChaplain(chaplainId) {
    return mockDb.query('stipend_records', r => r.chaplainId === chaplainId && r.isCompleted)
      .reduce((sum, r) => sum + (r.stipendAmount || 0), 0);
  },

  /**
   * Get encounter metrics by type
   * @param {string} type — encounter type key (e.g., 'crisis', 'grief', 'prayerRequested')
   */
  getEncountersByType(type) {
    return mockDb.query('chaplain_metrics', m => m.encounterType && m.encounterType[type]);
  },

  /**
   * Get encounters for a specific terminal
   * @param {string} terminal — 'A', 'B', 'C', 'D', or 'E'
   */
  getEncountersByTerminal(terminal) {
    return mockDb.query('chaplain_metrics', m => m.terminal === terminal);
  },

  /**
   * Calculate terminal distribution from metrics
   * @returns {Object} — { A: count, B: count, ... }
   */
  getTerminalDistribution() {
    const dist = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    mockDb.getAll('chaplain_metrics').forEach(m => {
      if (m.terminal && dist.hasOwnProperty(m.terminal)) {
        dist[m.terminal]++;
      }
    });
    return dist;
  },

  /**
   * Get chat threads for a user
   * @param {string} userId
   */
  getChatsForUser(userId) {
    return mockDb.query('chats', c => c.userA === userId || c.userB === userId);
  },

  /**
   * Get messages for a chat thread
   * @param {string} chatId
   */
  getChatMessages(chatId) {
    return mockDb.query('chat_messages', m => m.chatId === chatId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  /**
   * Get recent audit log entries
   * @param {number} [limit=20]
   */
  getRecentAuditLog(limit = 20) {
    return mockDb.getAll('audit_log')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  },

  /**
   * Get app settings
   */
  getSettings() {
    return mockDb.getRaw()?.app_settings || null;
  },

  /**
   * Resolve a user reference to a display name
   * @param {string} userId
   * @returns {string}
   */
  resolveUserName(userId) {
    const user = mockDb.getById('users', userId);
    return user ? user.displayName : 'Unknown';
  },

  /**
   * Get KPI dashboard metrics
   */
  getDashboardMetrics() {
    const users = mockDb.getAll('users');
    const chaplains = users.filter(u => u.isChaplain);
    const onDuty = chaplains.filter(u => u.onDuty);
    const metrics = mockDb.getAll('chaplain_metrics');
    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    return {
      totalUsers: users.length,
      totalChaplains: chaplains.length,
      onDutyNow: onDuty.length,
      newSignups7d: users.filter(u => new Date(u.createdAt) > sevenDaysAgo).length,
      newSignups30d: users.filter(u => new Date(u.createdAt) > thirtyDaysAgo).length,
      totalEncounters: metrics.length,
      encounters7d: metrics.filter(m => new Date(m.dateCollected) > sevenDaysAgo).length,
      encounters30d: metrics.filter(m => new Date(m.dateCollected) > thirtyDaysAgo).length,
      crisisEvents: metrics.filter(m => m.encounterType?.crisis).length,
      prayerRequests: metrics.filter(m => m.encounterType?.prayerRequested).length,
    };
  },
};


// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  mockDb.init();
});
