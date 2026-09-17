import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setDatabaseSelectionRequired, setDatabaseCreationRequired } from '../../state/authSlice';
import { setDbReady } from '../../state/pageSlice';

export const CreateDatabase: React.FC = () => {
  const [databaseName, setDatabaseName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/databases/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: databaseName })
      });
      const data = await res.json();

      if (data.success) {
        // Clear flags and navigate to invoices
        dispatch(setDatabaseCreationRequired(false));
        dispatch(setDatabaseSelectionRequired(false));
        dispatch(setDbReady(true));
        navigate('/invoices');
      } else {
        setError(data.message || 'Failed to create database. Please try a different name.');
      }
    } catch (err: any) {
      setError('An error occurred while creating the database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-200">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create Your Local Database
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            No local database is currently available for your account. Please create one to continue.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleCreate}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="database-name" className="sr-only">
                Database Name (Optional)
              </label>
              <input
                id="database-name"
                name="name"
                type="text"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Database Name (e.g. my_company) - Optional"
                value={databaseName}
                onChange={(e) => setDatabaseName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating Database...' : 'Create Local Database'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
