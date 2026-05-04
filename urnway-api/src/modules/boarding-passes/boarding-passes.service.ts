import { HttpError } from '../../utils/http-error.js';
import {
  findBoardingPassByIdForUser,
  findNextBoardingPassForUser,
  listBoardingPassesForUser,
} from '../bookings/bookings.repository.js';
import { serializeBoardingPass } from '../bookings/bookings.service.js';

type AuthenticatedUser = {
  id: string;
  walletAddress: string;
  sessionId: string;
};

function todayAsIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function listUserBoardingPasses(user: AuthenticatedUser) {
  const storedBoardingPasses = await listBoardingPassesForUser(user.id);

  return {
    boardingPasses: storedBoardingPasses
      .map((boardingPass) => serializeBoardingPass(boardingPass))
      .filter(Boolean),
  };
}

export async function getBoardingPassById(user: AuthenticatedUser, id: string) {
  const boardingPass = await findBoardingPassByIdForUser(user.id, id);

  if (!boardingPass) {
    throw new HttpError(404, 'Boarding pass not found');
  }

  return {
    boardingPass: serializeBoardingPass(boardingPass),
  };
}

export async function getNextBoardingPass(user: AuthenticatedUser) {
  const boardingPass = await findNextBoardingPassForUser(user.id, todayAsIsoDate());

  return {
    boardingPass: serializeBoardingPass(boardingPass),
  };
}
