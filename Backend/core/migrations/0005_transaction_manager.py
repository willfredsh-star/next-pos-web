import django.db.models.deletion
from django.db import migrations, models


def add_manager(apps, schema_editor):
    # MySQL/TiDB: ADD COLUMN dan ADD FOREIGN KEY dipisah karena TiDB menolak keduanya dalam satu perintah.
    # Database lain (mis. SQLite untuk tes/CI): FK didefinisikan langsung pada kolom, karena SQLite
    # tidak mendukung "ALTER TABLE ... ADD CONSTRAINT".
    if schema_editor.connection.vendor == 'mysql':
        schema_editor.execute('ALTER TABLE `core_transaction` ADD COLUMN `manager_id` bigint NULL', params=None)
        schema_editor.execute(
            'ALTER TABLE `core_transaction` '
            'ADD CONSTRAINT `core_transaction_manager_id_d830aa88_fk_core_employee_id` '
            'FOREIGN KEY (`manager_id`) REFERENCES `core_employee` (`id`)',
            params=None,
        )
    else:
        schema_editor.execute(
            'ALTER TABLE "core_transaction" ADD COLUMN "manager_id" bigint NULL '
            'REFERENCES "core_employee" ("id") DEFERRABLE INITIALLY DEFERRED',
            params=None,
        )


def remove_manager(apps, schema_editor):
    if schema_editor.connection.vendor == 'mysql':
        schema_editor.execute(
            'ALTER TABLE `core_transaction` DROP FOREIGN KEY `core_transaction_manager_id_d830aa88_fk_core_employee_id`',
            params=None,
        )
        schema_editor.execute('ALTER TABLE `core_transaction` DROP COLUMN `manager_id`', params=None)
    # Selain MySQL tidak dibalik (SQLite hanya dipakai untuk pengembangan/tes).


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_split_shared_menu'),
    ]

    operations = [
        # Nomor tidak lagi unik secara global, tapi unik per manajer (constraint ditambahkan di 0007).
        migrations.AlterField(
            model_name='transaction',
            name='number',
            field=models.PositiveIntegerField(),
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(add_manager, remove_manager),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='transaction',
                    name='manager',
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='restaurant_transactions',
                        to='core.employee',
                    ),
                ),
            ],
        ),
    ]
