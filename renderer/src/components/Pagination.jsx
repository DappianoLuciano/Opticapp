export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button
        className="btnSmall"
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
      >
        Anterior
      </button>
      <span className="paginationInfo">
        {page} / {totalPages}
      </span>
      <button
        className="btnSmall"
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
      >
        Siguiente
      </button>
    </div>
  );
}
