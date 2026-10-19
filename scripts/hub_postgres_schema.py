"""Pin the schema inside each transaction, including pooled server sessions."""
from psycopg2.extensions import cursor, TRANSACTION_STATUS_IDLE


class PublicSchemaCursor(cursor):
    def _pin_schema(self):
        if self.connection.get_transaction_status() == TRANSACTION_STATUS_IDLE:
            super().execute('SET LOCAL search_path TO public')

    def execute(self, query, vars=None):
        self._pin_schema()
        return super().execute(query, vars)

    def executemany(self, query, vars_list):
        self._pin_schema()
        return super().executemany(query, vars_list)
