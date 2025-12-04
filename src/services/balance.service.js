const { PrismaClient } = require('@prisma/client');
const AppError = require('../utils/appError');

const prisma = new PrismaClient();

// Helper function to calculate balances between users
const calculateBalances = (expenses) => {
  const balances = new Map(); // userId -> amount (positive means they are owed money, negative means they owe)

  expenses.forEach((expense) => {
    const paidBy = expense.paidById;
    const totalAmount = parseFloat(expense.amount);
    
    // Initialize user in balances if not exists
    if (!balances.has(paidBy)) {
      balances.set(paidBy, 0);
    }
    
    // Add the full amount to the person who paid
    balances.set(paidBy, balances.get(paidBy) + totalAmount);

    // Subtract each person's share
    expense.splits.forEach((split) => {
      const userId = split.userId;
      const amount = parseFloat(split.amount);
      
      if (!balances.has(userId)) {
        balances.set(userId, 0);
      }
      
      balances.set(userId, balances.get(userId) - amount);
    });
  });

  return balances;
};

// Helper function to minimize cash flow (simplify debts)
const minimizeCashFlow = (balances) => {
  // Convert map to array of {userId, amount} objects
  const balanceList = Array.from(balances.entries()).map(([userId, amount]) => ({
    userId,
    amount: parseFloat(amount.toFixed(2)),
  }));

  // Filter out users with zero balance
  const nonZeroBalances = balanceList.filter((user) => Math.abs(user.amount) > 0.01);
  
  const transactions = [];
  
  // While there are people with non-zero balances
  while (nonZeroBalances.length > 1) {
    // Find the person with the maximum credit (most positive)
    let maxCreditIdx = nonZeroBalances.reduce(
      (maxIdx, user, idx, arr) => (user.amount > arr[maxIdx].amount ? idx : maxIdx),
      0
    );
    
    // Find the person with the maximum debit (most negative)
    let maxDebitIdx = nonZeroBalances.reduce(
      (minIdx, user, idx, arr) => (user.amount < arr[minIdx].amount ? idx : minIdx),
      0
    );
    
    const maxCredit = nonZeroBalances[maxCreditIdx];
    const maxDebit = nonZeroBalances[maxDebitIdx];
    
    // Find the minimum of the absolute values
    const minAmount = Math.min(Math.abs(maxCredit.amount), Math.abs(maxDebit.amount));
    
    // Record the transaction
    transactions.push({
      from: maxDebit.userId,
      to: maxCredit.userId,
      amount: parseFloat(minAmount.toFixed(2)),
    });
    
    // Update the balances
    maxCredit.amount -= minAmount;
    maxDebit.amount += minAmount;
    
    // Remove users with zero balance
    if (Math.abs(maxCredit.amount) < 0.01) {
      nonZeroBalances.splice(maxCreditIdx, 1);
    }
    
    if (Math.abs(maxDebit.amount) < 0.01) {
      const removalIdx = maxDebitIdx > maxCreditIdx && Math.abs(maxCredit.amount) < 0.01
        ? maxDebitIdx - 1
        : maxDebitIdx;
      nonZeroBalances.splice(removalIdx, 1);
    }
  }
  
  return transactions;
};

// Get balances for a group
const getGroupBalances = async (groupId, userId) => {
  // Verify user is a member of the group
  const isMember = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId,
    },
  });

  if (!isMember) {
    throw new AppError('You are not a member of this group', 403);
  }

  // Get all expenses and their splits for the group
  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: {
      paidBy: {
        select: {
          id: true,
          name: true,
        },
      },
      splits: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  // Calculate raw balances
  const balances = calculateBalances(expenses);
  
  // Get user details for all users with non-zero balances
  const userIds = Array.from(balances.keys());
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  // Format balances with user details
  const formattedBalances = [];
  let totalOwed = 0;
  let totalOwe = 0;

  for (const [userId, amount] of balances.entries()) {
    const user = users.find((u) => u.id === userId);
    const balance = parseFloat(amount.toFixed(2));
    
    if (Math.abs(balance) >= 0.01) { // Ignore very small balances (floating point precision)
      if (balance > 0) {
        totalOwed += balance;
      } else {
        totalOwe += Math.abs(balance);
      }
      
      formattedBalances.push({
        user,
        amount: balance,
        type: balance > 0 ? 'owed' : 'owes',
      });
    }
  }

  // Calculate simplified transactions (who should pay whom)
  const transactions = minimizeCashFlow(balances);
  
  // Get user details for transactions
  const transactionUserIds = [
    ...new Set([
      ...transactions.map((t) => t.from),
      ...transactions.map((t) => t.to),
    ]),
  ];
  
  const transactionUsers = await prisma.user.findMany({
    where: {
      id: { in: transactionUserIds },
    },
    select: {
      id: true,
      name: true,
    },
  });
  
  const formattedTransactions = transactions.map((txn) => ({
    from: transactionUsers.find((u) => u.id === txn.from),
    to: transactionUsers.find((u) => u.id === txn.to),
    amount: txn.amount,
  }));

  return {
    balances: formattedBalances,
    transactions: formattedTransactions,
    summary: {
      totalOwed: parseFloat(totalOwed.toFixed(2)),
      totalOwe: parseFloat(totalOwe.toFixed(2)),
    },
  };
};

// Get user's balance across all groups
const getUserBalances = async (userId) => {
  // Get all groups the user is a member of
  const groupMemberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Get balances for each group
  const groupBalances = [];
  let totalOwed = 0;
  let totalOwe = 0;

  for (const membership of groupMemberships) {
    const groupId = membership.groupId;
    
    // Get all expenses and their splits for the group
    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: {
        paidBy: {
          select: {
            id: true,
            name: true,
          },
        },
        splits: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Calculate raw balances for the group
    const balances = calculateBalances(expenses);
    
    // Get the user's balance in this group
    const userBalance = balances.get(userId) || 0;
    
    if (Math.abs(userBalance) >= 0.01) { // Ignore very small balances
      if (userBalance > 0) {
        totalOwed += userBalance;
      } else {
        totalOwe += Math.abs(userBalance);
      }
      
      groupBalances.push({
        group: membership.group,
        amount: parseFloat(userBalance.toFixed(2)),
        type: userBalance > 0 ? 'owed' : 'owes',
      });
    }
  }

  return {
    balances: groupBalances,
    summary: {
      totalOwed: parseFloat(totalOwed.toFixed(2)),
      totalOwe: parseFloat(totalOwe.toFixed(2)),
      netBalance: parseFloat((totalOwed - totalOwe).toFixed(2)),
    },
  };
};

module.exports = {
  getGroupBalances,
  getUserBalances,
};
