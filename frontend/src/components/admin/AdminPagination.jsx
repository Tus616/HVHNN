export default function AdminPagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index);

  return (
    <div className="admin-pagination">
      <button
        type="button"
        className="admin-pagination-btn"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>

      <div className="admin-pagination-pages">
        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={`admin-pagination-btn ${page === pageNumber ? 'active' : ''}`}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber + 1}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="admin-pagination-btn"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
