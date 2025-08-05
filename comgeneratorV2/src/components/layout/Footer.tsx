import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              À propos
            </h3>
            <p className="mt-4 text-base text-gray-500 dark:text-gray-400">
              ProfAssist est un outil innovant pour la génération d'appréciations scolaires personnalisées.
            </p>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              Contact
            </h3>
            <ul className="mt-4 space-y-2">
              <li className="flex items-center text-gray-500 dark:text-gray-400">
                <Mail className="h-5 w-5 mr-2" />
                <a href="mailto:lionel.delorenzo@teachtech.fr" className="hover:text-blue-600">
                  lionel.delorenzo@teachtech.fr
                </a>
              </li>
              <li className="flex items-center text-gray-500 dark:text-gray-400">
                <MapPin className="h-5 w-5 mr-2" />
                <span>Busloup, France</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              Liens utiles
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link to="/login" className="text-gray-500 dark:text-gray-400 hover:text-blue-600">
                  Se connecter
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-gray-500 dark:text-gray-400 hover:text-blue-600">
                  S'inscrire
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-center text-base text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} ProfAssist. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}