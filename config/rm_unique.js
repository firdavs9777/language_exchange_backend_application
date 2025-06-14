const mongoose = require('mongoose');
const removeUniqueIndexes = async () => {
    try {
        // Connect using your existing config
        await mongoose.connect(process.env.MONGO_URI, {
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to MongoDB');
        const db = mongoose.connection.db;
        
        // Get all collections
        const collections = await db.listCollections().toArray();
        console.log('📋 Found collections:', collections.map(c => c.name));
        
        for (let collection of collections) {
            console.log(`\n🔍 Checking collection: ${collection.name}`);
            
            try {
                const indexes = await db.collection(collection.name).indexes();
                console.log(`  Found ${indexes.length} indexes`);
                
                for (let index of indexes) {
                    if (index.unique && index.name !== '_id_') {
                        console.log(`  🗑️  Dropping unique index: ${index.name}`);
                        await db.collection(collection.name).dropIndex(index.name);
                        console.log(`  ✅ Dropped ${index.name}`);
                    } else if (index.name !== '_id_') {
                        console.log(`  ℹ️  Keeping non-unique index: ${index.name}`);
                    }
                }
            } catch (error) {
                console.log(`  ❌ Error with ${collection.name}: ${error.message}`);
            }
        }
        
        console.log('\n🎉 Finished processing all collections!');
        
    } catch (error) {
        console.log('❌ Connection failed:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('👋 Disconnected from MongoDB');
        process.exit();
    }
};

module.exports = removeUniqueIndexes;