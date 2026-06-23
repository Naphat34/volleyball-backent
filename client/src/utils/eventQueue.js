/**
 * EventQueue Utility for Offline-First Match Scoring
 * Manages a persistent queue of match events in localStorage.
 */

const QUEUE_KEY = 'match_transaction_queue';

class EventQueue {
    /**
     * Pushes a new event onto the queue.
     * @param {Object} event { matchId, type, details, timestamp, score }
     */
    static push(event) {
        const queue = this.getQueue();
        const localId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newEvent = { ...event, localId, status: 'pending', retryCount: 0 };
        
        queue.push(newEvent);
        this.saveQueue(queue);
        return localId;
    }

    /**
     * Retrieves the entire queue.
     */
    static getQueue() {
        try {
            const saved = localStorage.getItem(QUEUE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Failed to parse event queue', e);
            return [];
        }
    }

    /**
     * Saves the queue to localStorage.
     */
    static saveQueue(queue) {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }

    /**
     * Gets the next item to sync (the oldest pending item).
     */
    static peek() {
        const queue = this.getQueue();
        return queue.find(e => e.status === 'pending') || null;
    }

    /**
     * Marks an event as "syncing" or increments retry count.
     */
    static markSyncing(localId) {
        const queue = this.getQueue();
        const index = queue.findIndex(e => e.localId === localId);
        if (index !== -1) {
            queue[index].status = 'syncing';
            this.saveQueue(queue);
        }
    }

    /**
     * Removes a successfully synced event from the queue.
     */
    static remove(localId) {
        let queue = this.getQueue();
        queue = queue.filter(e => e.localId !== localId);
        this.saveQueue(queue);
    }

    /**
     * Reset an event back to pending if sync failed.
     */
    static fail(localId) {
        const queue = this.getQueue();
        const index = queue.findIndex(e => e.localId === localId);
        if (index !== -1) {
            queue[index].status = 'pending';
            queue[index].retryCount += 1;
            this.saveQueue(queue);
        }
    }

    /**
     * Clears all events for a specific match (e.g., when match is finished and verified).
     */
    static clearMatch(matchId) {
        let queue = this.getQueue();
        queue = queue.filter(e => e.matchId !== matchId);
        this.saveQueue(queue);
    }
}

export default EventQueue;
