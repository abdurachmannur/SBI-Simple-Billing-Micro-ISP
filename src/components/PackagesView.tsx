import React, { useState } from 'react';
import { Wifi, Plus, Edit2, Trash2, Users } from 'lucide-react';
import { Customer, WifiPackage } from '../types';
import { formatRupiah } from '../utils';
import { ConfirmDialog, Modal } from './Modal';

interface PackagesViewProps {
  packages: WifiPackage[];
  customers: Customer[];
  onAddPackage: (pkg: Omit<WifiPackage, 'id' | 'ownerId'>) => Promise<void>;
  onUpdatePackage: (id: string, pkg: Partial<WifiPackage>) => Promise<void>;
  onDeletePackage: (id: string) => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function PackagesView({
  packages,
  customers,
  onAddPackage,
  onUpdatePackage,
  onDeletePackage,
  onNotify,
}: PackagesViewProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<WifiPackage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [name, setName] = useState('');
  const [speed, setSpeed] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [deletingPackage, setDeletingPackage] = useState<WifiPackage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openAddModal = () => {
    setEditingPackage(null);
    setName('');
    setSpeed('');
    setPrice('');
    setDescription('');
    setIsActive(true);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditModal = (pkg: WifiPackage) => {
    setEditingPackage(pkg);
    setName(pkg.name);
    setSpeed(pkg.speed);
    setPrice(String(pkg.price));
    setDescription(pkg.description || '');
    setIsActive(pkg.is_active);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Nama paket WiFi wajib diisi.');
      return;
    }
    if (!speed.trim()) {
      setFormError('Kecepatan paket wajib diisi (misal: 20 Mbps).');
      return;
    }
    const priceNum = Number(price);
    if (price === '' || isNaN(priceNum) || priceNum < 0) {
      setFormError('Harga paket wajib berupa angka yang valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        speed: speed.trim(),
        price: priceNum,
        description: description.trim(),
        is_active: isActive,
      };
      if (editingPackage) {
        await onUpdatePackage(editingPackage.id, payload);
        onNotify(`Paket "${payload.name}" berhasil diperbarui.`);
      } else {
        await onAddPackage(payload);
        onNotify(`Paket "${payload.name}" berhasil ditambahkan.`);
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan paket WiFi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPackage) return;
    setIsDeleting(true);
    try {
      await onDeletePackage(deletingPackage.id);
      onNotify(`Paket "${deletingPackage.name}" telah dihapus.`);
      setDeletingPackage(null);
    } catch (err: any) {
      onNotify(err?.message || 'Gagal menghapus paket.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Manajemen Paket WiFi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar paket layanan yang dapat dipilih saat menambah atau mengedit pelanggan.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Paket WiFi</span>
        </button>
      </div>

      {/* Packages Grid */}
      {packages.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <Wifi className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-4">
            Belum Ada Paket WiFi
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Buat paket layanan internet beserta kecepatan dan harga bulanan untuk memudahkan pendaftaran pelanggan.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-5 min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Paket Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => {
            const subscriberCount = customers.filter(
              (c) => c.package_name === pkg.name && c.status === 'active'
            ).length;

            return (
              <div
                key={pkg.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                        {pkg.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                          {pkg.speed}
                        </span>
                        <span>·</span>
                        <span
                          className={`font-semibold ${
                            pkg.is_active
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {pkg.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Wifi className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatRupiah(pkg.price)}
                      <span className="text-xs font-sans font-normal text-slate-500 dark:text-slate-400">
                        {' '}
                        / bulan
                      </span>
                    </p>
                  </div>

                  {pkg.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">
                      {pkg.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{subscriberCount}</span>
                    <span>pelanggan aktif</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(pkg)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-1 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingPackage(pkg)}
                      className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      title="Hapus Paket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Package Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingPackage ? 'Edit Paket WiFi' : 'Tambah Paket WiFi Baru'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-600 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Paket <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Paket Keluarga 20 Mbps"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kecepatan Bandwidth <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
                placeholder="Contoh: 20 Mbps"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Harga Bulanan (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="200000"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Deskripsi Paket
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ideal untuk 4-6 perangkat & streaming HD"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Paket Aktif (Tersedia untuk dipilih pelanggan baru)
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Paket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={Boolean(deletingPackage)}
        onClose={() => setDeletingPackage(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Hapus Paket WiFi"
        message={`Apakah Anda yakin ingin menghapus paket "${deletingPackage?.name}"?`}
      />
    </div>
  );
}
