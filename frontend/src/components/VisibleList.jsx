import React, { useEffect, useState } from 'react';
import { t } from '../i18n/translations';

export function VisibleList({ items, renderItem, emptyText, loading = false, batchSize = 10, className = 'card-list' }) {
  const [visibleCount, setVisibleCount] = useState(batchSize);

  useEffect(() => {
    setVisibleCount((currentCount) => {
      if (items.length <= batchSize) {
        return batchSize;
      }

      return Math.min(Math.max(currentCount, batchSize), items.length);
    });
  }, [items.length, batchSize]);

  if (items.length === 0 && !loading) {
    return <p className="empty-state">{emptyText}</p>;
  }

  const visibleItems = items.slice(0, visibleCount);

  return (
    <>
      <div className={className}>
        {visibleItems.map((item, index) => renderItem(item, index))}
      </div>
      {items.length > visibleCount && (
        <button className="load-more-button" onClick={() => setVisibleCount((count) => count + batchSize)} type="button">
          {t('common.loadMore')}
        </button>
      )}
    </>
  );
}
