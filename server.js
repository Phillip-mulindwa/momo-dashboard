const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Database path
const dbPath = path.join(__dirname, 'database/momo_transactions.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection with error handling
const getDbConnection = () => {
    return new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error connecting to database:', err.message);
        }
    });
};

// API Routes

// Get dashboard statistics
app.get('/api/stats', (req, res) => {
    const db = getDbConnection();
    
    const queries = {
        totalTransactions: 'SELECT COUNT(*) as count FROM transactions',
        totalAmount: 'SELECT COALESCE(SUM(amount), 0) as total FROM transactions',
        totalFees: 'SELECT COALESCE(SUM(fee), 0) as total FROM transactions WHERE fee > 0',
        uniqueContacts: 'SELECT COUNT(DISTINCT contact) as count FROM transactions WHERE contact IS NOT NULL',
        transactionTypes: `
            SELECT 
                transaction_type, 
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(AVG(amount), 0) as avg_amount
            FROM transactions 
            GROUP BY transaction_type 
            ORDER BY count DESC
        `,
        monthlyTrends: `
            SELECT 
                strftime('%Y-%m', date) as month,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount
            FROM transactions 
            GROUP BY strftime('%Y-%m', date)
            ORDER BY month DESC
            LIMIT 12
        `,
        recentTransactions: `
            SELECT * FROM transactions 
            ORDER BY date DESC, time DESC 
            LIMIT 10
        `
    };

    let stats = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;

    const checkComplete = () => {
        completed++;
        if (completed === totalQueries) {
            db.close();
            res.json(stats);
        }
    };

    // Execute all queries
    Object.entries(queries).forEach(([key, query]) => {
        db.all(query, [], (err, rows) => {
            if (err) {
                console.error(`Error in ${key} query:`, err.message);
                stats[key] = key.includes('total') || key.includes('count') ? 0 : [];
            } else {
                stats[key] = Array.isArray(rows) ? rows : rows;
                if (key === 'totalTransactions' || key === 'uniqueContacts') {
                    stats[key] = rows[0]?.count || 0;
                } else if (key === 'totalAmount' || key === 'totalFees') {
                    stats[key] = rows[0]?.total || 0;
                }
            }
            checkComplete();
        });
    });
});

// Get transactions with filtering and pagination
app.get('/api/transactions', (req, res) => {
    const db = getDbConnection();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    const search = req.query.search || '';
    const type = req.query.type || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';
    const minAmount = parseFloat(req.query.minAmount) || 0;
    const maxAmount = parseFloat(req.query.maxAmount) || Number.MAX_SAFE_INTEGER;

    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
        whereConditions.push('(message LIKE ? OR contact LIKE ? OR reference LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (type) {
        whereConditions.push('transaction_type = ?');
        params.push(type);
    }

    if (startDate) {
        whereConditions.push('date >= ?');
        params.push(startDate);
    }

    if (endDate) {
        whereConditions.push('date <= ?');
        params.push(endDate);
    }

    if (minAmount > 0) {
        whereConditions.push('amount >= ?');
        params.push(minAmount);
    }

    if (maxAmount < Number.MAX_SAFE_INTEGER) {
        whereConditions.push('amount <= ?');
        params.push(maxAmount);
    }

    const whereClause = whereConditions.join(' AND ');
    
    const countQuery = `SELECT COUNT(*) as total FROM transactions WHERE ${whereClause}`;
    const dataQuery = `
        SELECT * FROM transactions 
        WHERE ${whereClause}
        ORDER BY date DESC, time DESC 
        LIMIT ? OFFSET ?
    `;

    // Get total count first
    db.get(countQuery, params, (err, countResult) => {
        if (err) {
            console.error('Error counting transactions:', err.message);
            db.close();
            return res.status(500).json({ error: 'Database error' });
        }

        const totalRecords = countResult.total;
        const totalPages = Math.ceil(totalRecords / limit);

        // Get paginated data
        db.all(dataQuery, [...params, limit, offset], (err, transactions) => {
            db.close();
            
            if (err) {
                console.error('Error fetching transactions:', err.message);
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                transactions,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalRecords,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });
        });
    });
});

// Get transaction types for dropdown
app.get('/api/transaction-types', (req, res) => {
    const db = getDbConnection();
    
    const query = `
        SELECT DISTINCT transaction_type, COUNT(*) as count
        FROM transactions 
        WHERE transaction_type IS NOT NULL 
        GROUP BY transaction_type 
        ORDER BY count DESC
    `;

    db.all(query, [], (err, rows) => {
        db.close();
        
        if (err) {
            console.error('Error fetching transaction types:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json(rows);
    });
});

// Get monthly analytics
app.get('/api/analytics/monthly', (req, res) => {
    const db = getDbConnection();
    
    const query = `
        SELECT 
            strftime('%Y-%m', date) as month,
            strftime('%Y', date) as year,
            strftime('%m', date) as month_num,
            COUNT(*) as transaction_count,
            COALESCE(SUM(amount), 0) as total_amount,
            COALESCE(AVG(amount), 0) as avg_amount,
            COALESCE(SUM(fee), 0) as total_fees,
            COUNT(DISTINCT transaction_type) as unique_types
        FROM transactions 
        GROUP BY strftime('%Y-%m', date)
        ORDER BY month DESC
        LIMIT 24
    `;

    db.all(query, [], (err, rows) => {
        db.close();
        
        if (err) {
            console.error('Error fetching monthly analytics:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json(rows);
    });
});

// Get contact analytics
app.get('/api/analytics/contacts', (req, res) => {
    const db = getDbConnection();
    
    const query = `
        SELECT 
            contact,
            COUNT(*) as transaction_count,
            COALESCE(SUM(amount), 0) as total_amount,
            COALESCE(AVG(amount), 0) as avg_amount,
            MAX(date) as last_transaction
        FROM transactions 
        WHERE contact IS NOT NULL AND contact != ''
        GROUP BY contact
        ORDER BY transaction_count DESC
        LIMIT 50
    `;

    db.all(query, [], (err, rows) => {
        db.close();
        
        if (err) {
            console.error('Error fetching contact analytics:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json(rows);
    });
});

// Export data as JSON
app.get('/api/export/json', (req, res) => {
    const db = getDbConnection();
    
    const query = 'SELECT * FROM transactions ORDER BY date DESC, time DESC';

    db.all(query, [], (err, rows) => {
        db.close();
        
        if (err) {
            console.error('Error exporting data:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="momo_transactions.json"');
        res.json(rows);
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const db = getDbConnection();
    
    db.get('SELECT COUNT(*) as count FROM transactions', [], (err, row) => {
        db.close();
        
        if (err) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'Database connection failed',
                error: err.message 
            });
        }

        res.json({ 
            status: 'healthy', 
            database: 'connected',
            transactions: row.count,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down MTN MoMo Analytics Server...');
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 MTN MoMo Analytics Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}`);
    console.log(`🔗 API endpoints available at http://localhost:${PORT}/api/*`);
    console.log(`💾 Database: ${dbPath}`);
    console.log(`🌟 Server started at ${new Date().toISOString()}`);
}); 