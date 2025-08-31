import esClient from '../config/elasticsearch.js';
// import redisClient from '../config/redis.js';

//add authentication
export const search = async (req, res) => {
    console.log(req.body);
    const { keyword, type, advancedFields } = req.body;
    const cacheKey = `search_${keyword}_${type}_${JSON.stringify(advancedFields)}`;

    try {
        // const cachedData = await redisClient.get(cacheKey);
        // if (cachedData) {
        //     return res.json(JSON.parse(cachedData));
        // }

        const sanitizedKeyword = (keyword || '').replace(/[^\w\s]/g, '').trim();
        if (!sanitizedKeyword && (!advancedFields || advancedFields.length === 0)) {
            return res.status(400).json({ message: 'Search keyword or advanced fields required' });
        }

        let esQuery = {
            bool: {
                must: [],
                filter: []
            }
        };

        if (sanitizedKeyword) {
            esQuery.bool.must.push({
                multi_match: {
                    query: sanitizedKeyword,
                    fields: ['title^2', 'description', 'content']
                }
            });
        }

        if (advancedFields && advancedFields.length > 0) {
            advancedFields.forEach(field => {
                if (field.field && field.value) {
                    esQuery.bool.filter.push({
                        term: {
                            [field.field]: field.value
                        }
                    });
                }
            });
        }

        const { hits } = await esClient.search({
            index: type || ['courses', 'lectures', 'teachers'],
            body: {
                query: esQuery
            }
        });

        const results = hits.hits.map(hit => ({
            id: hit._id,
            type: hit._index,
            score: hit._score,
            ...hit._source
        }));

        // await redisClient.set(cacheKey, JSON.stringify(results), { EX: 3600 });

        res.json(results);
    } catch (error) {
        console.error('Error executing Elasticsearch query:', error.message);
        res.status(500).send('Server error');
    }
};
