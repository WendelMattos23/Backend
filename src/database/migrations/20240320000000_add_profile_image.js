exports.up = function(knex) {
    return knex.schema.table('clientes', function(table) {
        table.string('profile_image_url');
    });
};

exports.down = function(knex) {
    return knex.schema.table('clientes', function(table) {
        table.dropColumn('profile_image_url');
    });
}; 