import django.db.models.deletion
from django.db import migrations, models


def add_owner(apps, schema_editor):
    # MySQL/TiDB: ADD COLUMN dan ADD FOREIGN KEY dipisah karena TiDB menolak keduanya dalam satu perintah.
    # Database lain (mis. SQLite untuk tes/CI): FK didefinisikan langsung pada kolom, karena SQLite
    # tidak mendukung "ALTER TABLE ... ADD CONSTRAINT".
    if schema_editor.connection.vendor == 'mysql':
        schema_editor.execute('ALTER TABLE `core_product` ADD COLUMN `owner_id` bigint NULL', params=None)
        schema_editor.execute(
            'ALTER TABLE `core_product` '
            'ADD CONSTRAINT `core_product_owner_id_fk_core_employee_id` '
            'FOREIGN KEY (`owner_id`) REFERENCES `core_employee` (`id`)',
            params=None,
        )
    else:
        schema_editor.execute(
            'ALTER TABLE "core_product" ADD COLUMN "owner_id" bigint NULL '
            'REFERENCES "core_employee" ("id") DEFERRABLE INITIALLY DEFERRED',
            params=None,
        )


def remove_owner(apps, schema_editor):
    if schema_editor.connection.vendor == 'mysql':
        schema_editor.execute(
            'ALTER TABLE `core_product` DROP FOREIGN KEY `core_product_owner_id_fk_core_employee_id`',
            params=None,
        )
        schema_editor.execute('ALTER TABLE `core_product` DROP COLUMN `owner_id`', params=None)
    # Selain MySQL tidak dibalik (SQLite hanya dipakai untuk pengembangan/tes).


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_transaction_guest_count'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_owner, remove_owner),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='product',
                    name='owner',
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='products',
                        to='core.employee',
                    ),
                ),
            ],
        ),
    ]
