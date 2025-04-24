import React from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Box,
  CircularProgress,
  Typography,
  IconButton,
  Tooltip
} from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';
import PropTypes from 'prop-types';

/**
 * Reusable data table component with sorting and pagination
 */
const DataTable = ({
  columns,
  data,
  loading = false,
  pagination = true,
  totalRows = 0,
  page = 0,
  rowsPerPage = 10,
  rowsPerPageOptions = [10, 25, 50],
  onChangePage,
  onChangeRowsPerPage,
  sortBy,
  sortDirection,
  onSort,
  noDataMessage = 'No data available',
  stickyHeader = true,
  maxHeight,
  minHeight = 400
}) => {
  const handleSort = (columnId) => {
    if (onSort) {
      const newDirection = sortBy === columnId && sortDirection === 'asc' ? 'desc' : 'asc';
      onSort(columnId, newDirection);
    }
  };

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: maxHeight, minHeight }}>
        <Table stickyHeader={stickyHeader}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  style={{ 
                    minWidth: column.minWidth, 
                    width: column.width,
                    cursor: column.sortable ? 'pointer' : 'default',
                    fontWeight: 'bold'
                  }}
                  onClick={() => column.sortable && handleSort(column.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start' }}>
                    {column.label}
                    {column.sortable && sortBy === column.id && (
                      <Box sx={{ ml: 0.5 }}>
                        {sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                      </Box>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 5 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : data && data.length > 0 ? (
              data.map((row, rowIndex) => (
                <TableRow hover key={row.id || rowIndex}>
                  {columns.map((column) => {
                    const value = row[column.id];
                    return (
                      <TableCell key={column.id} align={column.align || 'left'}>
                        {column.render ? column.render(value, row) : value}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">{noDataMessage}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {pagination && (
        <TablePagination
          rowsPerPageOptions={rowsPerPageOptions}
          component="div"
          count={totalRows}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => onChangePage(newPage)}
          onRowsPerPageChange={(e) => onChangeRowsPerPage(parseInt(e.target.value, 10))}
        />
      )}
    </Paper>
  );
};

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      align: PropTypes.oneOf(['left', 'right', 'center']),
      minWidth: PropTypes.number,
      width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      sortable: PropTypes.bool,
      render: PropTypes.func
    })
  ).isRequired,
  data: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  pagination: PropTypes.bool,
  totalRows: PropTypes.number,
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  rowsPerPageOptions: PropTypes.arrayOf(PropTypes.number),
  onChangePage: PropTypes.func,
  onChangeRowsPerPage: PropTypes.func,
  sortBy: PropTypes.string,
  sortDirection: PropTypes.oneOf(['asc', 'desc']),
  onSort: PropTypes.func,
  noDataMessage: PropTypes.string,
  stickyHeader: PropTypes.bool,
  maxHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  minHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
};

export default DataTable;